/**
 * Centralized routes configuration
 * Single source of truth for all application routes
 */

const DASHBOARD_PREFIX = "/dashboard";
export const API_PREFIX = "/api";

export const apiRoutes = {
  authCallback: `${API_PREFIX}/auth/callback`,
} as const;

export const pages = {
  // Public
  home: "/",
  login: "/login",
  authConfirm: "/auth/confirm",

  // Main app sections
  dashboard: `${DASHBOARD_PREFIX}`,
  hotDeals: `${DASHBOARD_PREFIX}/hot-deals`,
  subscription: `${DASHBOARD_PREFIX}/subscription`,
  account: `${DASHBOARD_PREFIX}/account`,

  // Alerts routes
  alerts: {
    list: `${DASHBOARD_PREFIX}/alerts`,
    new: `${DASHBOARD_PREFIX}/alerts/new`,
    edit: (id: string) => `${DASHBOARD_PREFIX}/alerts/${id}/edit`,
  },
} as const;

/**
 * Extract all static route values (string literals only, not functions)
 * Useful for contexts that only accept string paths (e.g., revalidatePath)
 */
type ExtractStaticRoutes<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? { [K in keyof T]: ExtractStaticRoutes<T[K]> }[keyof T]
    : never;

export type TStaticRoute = ExtractStaticRoutes<typeof pages>;
