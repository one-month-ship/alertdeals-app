/**
 * Centralized routes configuration
 * Single source of truth for all application routes
 */

export const pages = {
  // Public
  home: '/',
  login: '/login',
  authCallback: '/api/auth/callback',

  // Protected
  hotDeals: '/hot-deals',
  alerts: {
    list: '/alerts',
    new: '/alerts/new',
    edit: (id: string) => `/alerts/${id}/edit`,
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
