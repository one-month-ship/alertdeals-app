import { API_PREFIX, pages } from '@/config/routes';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { attributionConfig, type TAccountAttribution } from '@alertdeals/shared';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Attribution marketing : la landing transmet utm_* / fbclid / gclid dans l'URL.
 * L'aller-retour magic link / OAuth les perd, donc la première visite portant ces
 * paramètres est stockée dans un cookie de courte durée, lu une seule fois à la
 * première connexion (voir marketing.service). Le premier contact gagne : un cookie
 * déjà présent n'est jamais écrasé.
 */
function buildAttributionCookie(request: NextRequest): string | null {
  if (request.cookies.has(attributionConfig.cookieName)) return null;

  const attribution: Partial<TAccountAttribution> = {};
  for (const param of attributionConfig.params) {
    const value = request.nextUrl.searchParams.get(param);
    if (value) attribution[param] = value;
  }
  if (Object.keys(attribution).length === 0) return null;

  attribution.capturedAt = new Date().toISOString();
  return JSON.stringify(attribution);
}

/** SameSite=Lax pour laisser passer le retour d'un OAuth externe. */
function setAttributionCookie(response: NextResponse, value: string | null) {
  if (!value) return response;
  response.cookies.set(attributionConfig.cookieName, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: attributionConfig.cookieMaxAgeDays * 24 * 60 * 60,
  });
  return response;
}

export async function updateSession(request: NextRequest) {
  const attributionCookie = buildAttributionCookie(request);

  let supabaseResponse = NextResponse.next({ request });

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // A simple mistake could make it very hard to debug issues with users being
  // randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith(API_PREFIX);
  const isAuthCallbackPage = pathname.startsWith('/auth');
  const isApiOrDashboardRoute = pathname.startsWith(pages.dashboard) || isApiRoute;
  const loginRedirectionNeeded =
    !user && pathname !== pages.login && !isApiRoute && !isAuthCallbackPage;

  if (loginRedirectionNeeded)
    return setAttributionCookie(
      NextResponse.redirect(new URL(pages.login, request.url)),
      attributionCookie,
    );
  else if (user && !isApiOrDashboardRoute && !isAuthCallbackPage)
    return setAttributionCookie(
      NextResponse.redirect(new URL(pages.dashboard, request.url)),
      attributionCookie,
    );

  // IMPORTANT: return supabaseResponse as-is, don't replace it.
  // Cookies on it must reach the browser to keep the session alive.
  // On n'ajoute que notre propre cookie ; ceux de Supabase restent intacts.
  return setAttributionCookie(supabaseResponse, attributionCookie);
}
