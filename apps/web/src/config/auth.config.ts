/**
 * Whether self-signups must be confirmed by a super-admin before they can log
 * in. Env-driven so the mode can be switched without a code change. Off by
 * default to remove signup friction: accounts are auto-confirmed on their first
 * login instead. The admin validation flow (pending list, `validateUser`) stays
 * in place for when this is turned back on.
 */
export const authConfig = {
  adminValidationRequired: process.env.ADMIN_VALIDATION_REQUIRED === "true",
};
