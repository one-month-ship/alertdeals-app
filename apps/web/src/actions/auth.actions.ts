'use server';

import { pages } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';
import { magicLinkSchema } from '@/validation-schemas';
import { redirect } from 'next/navigation';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Send a magic link to the user's email
 */
export async function signInWithMagicLink(formData: { email: string }) {
  const result = magicLinkSchema.safeParse(formData);
  if (!result.success) {
    return { error: result.error.message };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: result.data.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl}${pages.authCallback}`,
    },
  });

  if (error) return { error: error.message };

  return { success: true };
}

/**
 * Initiate Google OAuth sign-in
 */
export async function signInWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}${pages.authCallback}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { success: true };
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  redirect(pages.login);
}

/**
 * Get the current authenticated user (server-side)
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
