import { pages } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const USER_ERRORS = {
  GENERIC: 'La connexion a échoué. Réessaie ou contacte-nous si le problème persiste.',
  LINK_EXPIRED: 'Ton lien de connexion a expiré. Demande un nouveau lien depuis la page de connexion.',
  LINK_INVALID: 'Lien de connexion invalide. Demande un nouveau lien depuis la page de connexion.',
  OAUTH_DENIED: 'Connexion Google annulée. Réessaie quand tu veux.',
  NOT_CONFIRMED:
    'Ton compte est en attente de validation par notre équipe. Tu recevras un email dès qu’il sera prêt.',
  ACCOUNT_FETCH: 'Impossible d’accéder à ton compte pour le moment. Réessaie dans quelques instants.',
} as const;

/**
 * Map known raw provider/Supabase error strings to user-friendly French messages.
 * Falls back to GENERIC for anything unexpected.
 */
function mapAuthError(raw: string | null | undefined): string {
  if (!raw) return USER_ERRORS.GENERIC;
  const lower = raw.toLowerCase();

  if (lower.includes('expired')) return USER_ERRORS.LINK_EXPIRED;
  if (lower.includes('invalid') && (lower.includes('token') || lower.includes('otp'))) {
    return USER_ERRORS.LINK_INVALID;
  }
  if (lower.includes('access_denied') || lower.includes('user denied')) {
    return USER_ERRORS.OAUTH_DENIED;
  }

  return USER_ERRORS.GENERIC;
}

function redirectToLogin(origin: string, message: string) {
  return NextResponse.redirect(`${origin}${pages.login}?error=${encodeURIComponent(message)}`);
}

async function handleAuthSuccess(origin: string): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToLogin(origin, USER_ERRORS.GENERIC);
  }

  const { data: account, error: fetchError } = await supabase
    .from('accounts')
    .select('id, confirmed_by_admin, is_first_connexion')
    .eq('id', user.id)
    .single();

  if (fetchError || !account) {
    console.error('[auth/callback] account fetch failed', { userId: user.id, fetchError });
    await supabase.auth.signOut();
    return redirectToLogin(origin, USER_ERRORS.ACCOUNT_FETCH);
  }

  if (!account.confirmed_by_admin) {
    await supabase.auth.signOut();
    return redirectToLogin(origin, USER_ERRORS.NOT_CONFIRMED);
  }

  if (account.is_first_connexion) {
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ is_first_connexion: false })
      .eq('id', user.id);
    if (updateError) {
      console.error('[auth/callback] is_first_connexion update failed', updateError);
    }
    return NextResponse.redirect(`${origin}${pages.alerts.new}`);
  }

  return NextResponse.redirect(`${origin}${pages.dashboard}`);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const providerError = searchParams.get('error');
  const providerErrorDescription = searchParams.get('error_description');

  if (providerError || providerErrorDescription) {
    console.error('[auth/callback] provider returned error', {
      providerError,
      providerErrorDescription,
    });
    return redirectToLogin(origin, mapAuthError(providerErrorDescription || providerError));
  }

  // Magic link / invite flow
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'email' | 'invite' | 'magiclink' | 'recovery',
    });

    if (verifyError) {
      console.error('[auth/callback] verifyOtp failed', verifyError);
      return redirectToLogin(origin, mapAuthError(verifyError.message));
    }
    return handleAuthSuccess(origin);
  }

  // OAuth flow (Google)
  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[auth/callback] exchangeCodeForSession failed', exchangeError);
      return redirectToLogin(origin, mapAuthError(exchangeError.message));
    }
    return handleAuthSuccess(origin);
  }

  // Nothing to handle — unexpected hit
  console.error('[auth/callback] hit with no code, token_hash, or error', {
    url: request.url,
  });
  return redirectToLogin(origin, USER_ERRORS.GENERIC);
}
