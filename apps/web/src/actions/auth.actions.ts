"use server";

import { pages } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/utils/get-site-url';
import { magicLinkSchema } from '@/validation-schemas';
import { EAuthErrorCode, EGeneralErrorCode } from '@alertdeals/shared';
import { redirect } from 'next/navigation';

const siteUrl = getSiteUrl();

export async function signInWithMagicLink(formData: { email: string }) {
  const result = magicLinkSchema.safeParse(formData);
  if (!result.success) {
    return { error: EGeneralErrorCode.VALIDATION_FAILED };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: result.data.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl}${pages.authCallback}`,
    },
  });

  if (error) return { error: EAuthErrorCode.AUTH_ERROR };

  return { success: true };
}

export async function signInWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}${pages.authCallback}`,
    },
  });

  if (error) {
    return { error: EAuthErrorCode.AUTH_ERROR };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: EAuthErrorCode.AUTH_ERROR };
  }

  redirect(pages.login);
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
