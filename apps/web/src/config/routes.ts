/**
 * Centralized routes configuration
 * Single source of truth for all application routes
 */

export const pages = {
  // Public
  home: "/",
  login: "/login",
  authConfirm: "/auth/confirm",

  // Protected
  hotDeals: "/hot-deals",
  alerts: {
    list: "/alerts",
    new: "/alerts/new",
    edit: (id: string) => `/alerts/${id}/edit`,
  },
  subscription: "/subscription",
  account: "/account",
} as const;

export const apiRoutes = {
  authCallback: "/api/auth/callback",
} as const;
