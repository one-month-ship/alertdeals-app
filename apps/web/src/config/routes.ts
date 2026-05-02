/**
 * Centralized routes configuration
 * Single source of truth for all application routes
 */

const DASHBOARD_PREFIX = '/dashboard';

export const pages = {
  // Authentication
  home: '/',
  login: '/login',
  authCallback: '/auth/callback',

  // Main app
  dashboard: DASHBOARD_PREFIX,

  // Alerts
  alerts: {
    list: `${DASHBOARD_PREFIX}/alerts`,
    new: `${DASHBOARD_PREFIX}/alerts/new`,
  },
} as const;

type ExtractStaticRoutes<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? { [K in keyof T]: ExtractStaticRoutes<T[K]> }[keyof T]
    : never;

export type TStaticRoute = ExtractStaticRoutes<typeof pages>;
