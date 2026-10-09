/**
 * Ad Configuration — single source of truth for deal-quality tiers (`goodDealName`).
 * Shared between the ingestion worker and the web UI.
 */

// `vehicle_states` seed id of "Endommagé": the only state an alert filters on
// (the other rows are condition levels of undamaged cars, not damage flags)
export const DAMAGED_VEHICLE_STATE_ID = 1;

export const AD_GOOD_DEAL_DEFINITIONS = [
  {
    key: 'VERY_GOOD',
    value: 'Très bonne affaire',
    label: 'Très bonne affaire',
    sublabel: 'Opportunité en or',
    shortLabel: 'Top deal',
    icon: 'flame',
    tone: 'premium',
  },
  {
    key: 'GOOD',
    value: 'Bonne affaire',
    label: 'Bonne affaire',
    sublabel: 'Prix attractif',
    shortLabel: 'Bon prix',
    icon: 'sparkles',
    tone: 'positive',
  },
] as const;

export const EAdGoodDeal = Object.fromEntries(
  AD_GOOD_DEAL_DEFINITIONS.map((d) => [d.key, d.value]),
) as {
  [K in (typeof AD_GOOD_DEAL_DEFINITIONS)[number]['key']]: Extract<
    (typeof AD_GOOD_DEAL_DEFINITIONS)[number],
    { key: K }
  >['value'];
};

export type TAdGoodDeal = (typeof AD_GOOD_DEAL_DEFINITIONS)[number]['value'];

export const getAdGoodDealConfig = (value: string | null | undefined) => {
  if (!value) return null;
  return AD_GOOD_DEAL_DEFINITIONS.find((d) => d.value === value) ?? null;
};

/**
 * Seller type of a listing ("typologie d'offre"): private individual or
 * professional dealer. Stored on `ads.owner_type` (null = the source does not
 * say) and used as an alert criterion (`alerts.owner_type`, null = both).
 */
export const AD_OWNER_TYPE_DEFINITIONS = [
  {
    key: 'PRIVATE',
    value: 'private',
    label: 'Particulier',
    pluralLabel: 'Particuliers',
    description: 'Annonces publiées par des particuliers',
  },
  {
    key: 'PRO',
    value: 'pro',
    label: 'Professionnel',
    pluralLabel: 'Professionnels',
    description: 'Annonces publiées par des professionnels (garages, concessions…)',
  },
] as const;

export const EAdOwnerType = Object.fromEntries(
  AD_OWNER_TYPE_DEFINITIONS.map((d) => [d.key, d.value]),
) as {
  [K in (typeof AD_OWNER_TYPE_DEFINITIONS)[number]['key']]: Extract<
    (typeof AD_OWNER_TYPE_DEFINITIONS)[number],
    { key: K }
  >['value'];
};

export type TAdOwnerType = (typeof AD_OWNER_TYPE_DEFINITIONS)[number]['value'];

export const AD_OWNER_TYPE_VALUES = AD_OWNER_TYPE_DEFINITIONS.map((d) => d.value) as [
  TAdOwnerType,
  ...TAdOwnerType[],
];

export const getAdOwnerTypeConfig = (value: TAdOwnerType) => {
  const config = AD_OWNER_TYPE_DEFINITIONS.find((d) => d.value === value);
  if (!config) throw new Error(`Invalid ad owner type: ${value}`);
  return config;
};

export const getAdOwnerTypeLabel = (value: TAdOwnerType): string =>
  getAdOwnerTypeConfig(value).label;
