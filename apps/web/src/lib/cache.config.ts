export const CACHE_TAGS = {
  alertsByAccount: (accountId: string) => `alerts:${accountId}`,
  alert: (id: string) => `alert:${id}`,
  brands: 'brands',
  vehicleModels: 'vehicle-models',
} as const;
