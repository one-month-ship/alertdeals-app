/**
 * Centralized routes configuration
 * Single source of truth for all application routes
 */

export const pages = {
  // Public
  home: '/',
  login: '/login',
  authCallback: '/auth/callback',

  // Protected (route group, URLs at root)
  hotDeals: '/hot-deals',
  alerts: {
    list: '/alerts',
    new: '/alerts/new',
  },
  subscription: '/subscription',
  account: '/account',
} as const;

type ExtractStaticRoutes<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? { [K in keyof T]: ExtractStaticRoutes<T[K]> }[keyof T]
    : never;

export type TStaticRoute = ExtractStaticRoutes<typeof pages>;
