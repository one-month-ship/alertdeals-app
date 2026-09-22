'use server';

import { pages } from '@/config/routes';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserAccount } from '@/services/account.service';
import { getSiteUrl } from '@/utils/get-site-url';
import { inviteUserSchema } from '@/validation-schemas';
import { accounts, eq, getDBAdminClient } from '@alertdeals/db';
import { EAdminRole, EAuthErrorCode, EGeneralErrorCode } from '@alertdeals/shared';
import { revalidatePath } from 'next/cache';

/**
 * Invite a new user by email (admin only).
 *
 * Restricts sign-up to people we explicitly invite: Supabase sends an
 * invitation email, and only its recipient gets a working sign-up link.
 */
export async function inviteUser(formData: { email: string }) {
  // Caller must be a logged-in admin (any admin role)
  const account = await getUserAccount({ columnsToKeep: { adminRole: true } });

  if (!account?.adminRole) {
    console.warn('[inviteUser] FORBIDDEN - caller is not admin', {
      hasAccount: !!account,
      adminRole: account?.adminRole,
    });
    return { error: EGeneralErrorCode.FORBIDDEN };
  }

  // Validate input
  const result = inviteUserSchema.safeParse(formData);
  if (!result.success) {
    console.warn('[inviteUser] VALIDATION_FAILED', {
      issues: result.error.issues,
    });
    return { error: EGeneralErrorCode.VALIDATION_FAILED };
  }

  const { email } = result.data;

  // Admin invite links return the session in the URL fragment (implicit flow),
  // which the server can't read — so we point at the client confirm page.
  const redirectTo = `${getSiteUrl()}${pages.authConfirm}`;

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (creationError) {
    console.error('[inviteUser] createAdminClient threw', creationError);
    return { error: EAuthErrorCode.AUTH_ERROR };
  }

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error('[inviteUser] inviteUserByEmail FAILED', {
      message: error.message,
      status: (error as { status?: number }).status,
      code: (error as { code?: string }).code,
      name: error.name,
      fullError: error,
    });

    // Supabase returns email_exists / "already been registered" when the
    // address already has an account: surface a dedicated message.
    const code = (error as { code?: string }).code;
    const message = error.message?.toLowerCase() ?? '';
    if (
      code === 'email_exists' ||
      message.includes('already been registered') ||
      message.includes('already exists')
    ) {
      return { error: EAuthErrorCode.USER_ALREADY_EXISTS };
    }

    return { error: EAuthErrorCode.AUTH_ERROR };
  }

  // The DB trigger detects the invite (auth.users.invited_at is set natively by
  // inviteUserByEmail) and creates the account row with confirmed_by_admin = true,
  // so the invited user can complete sign-in right away — no extra UPDATE needed
  // here (which would race with the trigger).
  return { success: true };
}

/**
 * Validate a self-signed-up user (super-admin only).
 *
 * When `ADMIN_VALIDATION_REQUIRED=true`, self-signups stay pending
 * (`confirmedByAdmin = false`) until a super-admin confirms them here. We flip
 * the flag, then send a magic link so the user can sign in — without creating
 * a new auth user (`shouldCreateUser: false`).
 */
export async function validateUser(formData: { email: string }) {
  // Caller must be a logged-in super-admin
  const account = await getUserAccount({ columnsToKeep: { adminRole: true } });

  if (account?.adminRole !== EAdminRole.SUPER_ADMIN) {
    console.warn('[validateUser] FORBIDDEN - caller is not super-admin', {
      hasAccount: !!account,
      adminRole: account?.adminRole,
    });
    return { error: EGeneralErrorCode.FORBIDDEN };
  }

  // Validate input
  const result = inviteUserSchema.safeParse(formData);
  if (!result.success) {
    console.warn('[validateUser] VALIDATION_FAILED', {
      issues: result.error.issues,
    });
    return { error: EGeneralErrorCode.VALIDATION_FAILED };
  }

  const { email } = result.data;
  const db = getDBAdminClient();

  const targetAccount = await db.query.accounts.findFirst({
    where: (table, { eq }) => eq(table.email, email),
  });

  if (!targetAccount) {
    console.warn('[validateUser] NOT_FOUND - no account for email');
    return { error: EGeneralErrorCode.NOT_FOUND };
  }

  try {
    await db
      .update(accounts)
      .set({ confirmedByAdmin: true })
      .where(eq(accounts.email, email));
  } catch (updateError) {
    console.error('[validateUser] update FAILED', updateError);
    return { error: EGeneralErrorCode.DATABASE_ERROR };
  }

  // Magic-link sign-in flow returns the session in the URL fragment, so we
  // point at the client confirm page (same redirect as the invite flow).
  const redirectTo = `${getSiteUrl()}${pages.authConfirm}`;

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (creationError) {
    console.error('[validateUser] createAdminClient threw', creationError);
    return { error: EAuthErrorCode.AUTH_ERROR };
  }

  const { error } = await supabaseAdmin.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  });

  if (error) {
    console.error('[validateUser] signInWithOtp FAILED', {
      message: error.message,
      status: (error as { status?: number }).status,
      code: (error as { code?: string }).code,
    });
    return { error: EAuthErrorCode.AUTH_ERROR };
  }

  // Refresh the pending-accounts list so the validated row disappears
  revalidatePath(pages.admin);

  return { success: true };
}
