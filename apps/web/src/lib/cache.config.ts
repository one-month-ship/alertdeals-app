export const CACHE_TAGS = {
  alertsByAccount: (accountId: string) => `alerts:${accountId}`,
  alert: (id: string) => `alert:${id}`,
} as const;
