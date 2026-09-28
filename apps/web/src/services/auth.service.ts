import "server-only";

import { authConfig } from "@/config/auth.config";
import { createClient } from "@/lib/supabase/server";
import { recordSignup } from "@/services/marketing.service";
import { accounts, eq, getDBAdminClient } from "@alertdeals/db";
import { EAuthErrorCode } from "@alertdeals/shared";

/**
 * Result of the post-authentication business logic.
 * `ok: true` means the session is valid AND the account passes all gates
 * (exists, confirmed by admin); `next` is where the caller should redirect.
 * `ok: false` carries a stable error code the client maps to a FR message.
 */
export type TPostAuthResult =
  | { ok: true; next: string }
  | { ok: false; error: EAuthErrorCode };

/**
 * Shared post-authentication gate, run once a Supabase session exists
 * (whatever the flow that produced it: verifyOtp, code exchange, or the
 * implicit/hash flow handled client-side then persisted via setSession).
 *
 * Checks the account exists and is confirmed by an admin (or auto-confirms it
 * when admin validation is disabled), then signs out on any failure. Returns
 * a serializable result so it can be consumed both by the auth callback route
 * and by a server action called from the client confirm page.
 */
export async function handlePostAuth(next: string): Promise<TPostAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn("[auth.service] no user - AUTH_ERROR");
    return { ok: false, error: EAuthErrorCode.AUTH_ERROR };
  }

  try {
    const db = getDBAdminClient();
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, user.id),
      columns: {
        id: true,
        email: true,
        confirmedByAdmin: true,
        isFirstConnexion: true,
      },
    });

    if (!account) {
      console.warn("[auth.service] ACCOUNT_FETCH_FAILED - signing out");
      await supabase.auth.signOut();
      return { ok: false, error: EAuthErrorCode.ACCOUNT_FETCH_FAILED };
    }

    if (!account.confirmedByAdmin) {
      if (authConfig.adminValidationRequired) {
        console.warn(
          "[auth.service] ACCOUNT_PENDING_VALIDATION - not confirmed by admin",
          { accountId: account.id },
        );
        await supabase.auth.signOut();
        return { ok: false, error: EAuthErrorCode.ACCOUNT_PENDING_VALIDATION };
      }

      // No admin validation: confirm the account itself so it drops out of
      // the pending list and stays confirmed if validation is re-enabled.
      await db
        .update(accounts)
        .set({ confirmedByAdmin: true })
        .where(eq(accounts.id, account.id));
    }

    // Première connexion = l'inscription : on rattache la campagne d'origine au compte
    // (cookie posé par le proxy) et on remonte la conversion à Meta. Ne lève jamais.
    if (account.isFirstConnexion) {
      await recordSignup({ id: account.id, email: account.email });
      await db
        .update(accounts)
        .set({ isFirstConnexion: false })
        .where(eq(accounts.id, account.id));
    }
  } catch (error) {
    console.error("[auth.service] handlePostAuth threw - signing out", error);
    await supabase.auth.signOut();
    return { ok: false, error: EAuthErrorCode.AUTH_ERROR };
  }

  return { ok: true, next };
}
