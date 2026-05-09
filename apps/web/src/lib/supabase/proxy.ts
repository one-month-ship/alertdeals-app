import { pages } from '@/config/routes';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  pages.hotDeals,
  pages.alerts.list,
  pages.subscription,
  pages.account,
] as const;

export async function updateSession(request: NextRequest) {
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
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = pathname === pages.login || pathname.startsWith('/api/auth');
  const isHome = pathname === pages.home;

  if (isHome) {
    return NextResponse.redirect(
      new URL(user ? pages.hotDeals : pages.login, request.url),
    );
  }

  // No user on a protected route → redirect to login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = pages.login;
    return NextResponse.redirect(url);
  }

  // Logged-in user on auth/login pages → redirect to main feature
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL(pages.hotDeals, request.url));
  }

  // IMPORTANT: return supabaseResponse as-is, don't replace it.
  // Cookies on it must reach the browser to keep the session alive.
  return supabaseResponse;
}
