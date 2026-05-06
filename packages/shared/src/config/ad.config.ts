/**
 * Ad Configuration — single source of truth for deal-quality tiers (`goodDealName`).
 * Shared between the ingestion worker and the web UI.
 */

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
