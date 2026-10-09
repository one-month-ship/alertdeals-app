/**
 * Ad Source Configuration — single source of truth for the listing platforms
 * we ingest ads from (one Lobstr squid per platform).
 */

export const AD_SOURCE_DEFINITIONS = [
  {
    key: 'LEBONCOIN',
    value: 'leboncoin',
    label: 'Leboncoin',
    description: 'Annonces Leboncoin',
    color: 'amber',
    isEnabled: true,
  },
  {
    key: 'AUTOSCOUT24',
    value: 'autoscout24',
    label: 'AutoScout24',
    description: 'Annonces AutoScout24',
    color: 'orange',
    isEnabled: true,
  },
  {
    key: 'LACENTRALE',
    value: 'lacentrale',
    label: 'LaCentrale',
    description: 'Annonces LaCentrale',
    color: 'red',
    isEnabled: true,
  },
  {
    key: 'PARUVENDU',
    value: 'paruvendu',
    label: 'ParuVendu',
    description: 'Annonces ParuVendu',
    color: 'blue',
    // Squid/mapper/enum kept for a possible reactivation; hidden from alerts
    // meanwhile (no market estimate, so no good deal detection either)
    isEnabled: false,
  },
] as const;

// Enum-like constant access (e.g., EAdSource.LEBONCOIN)
export const EAdSource = Object.fromEntries(
  AD_SOURCE_DEFINITIONS.map((source) => [source.key, source.value]),
) as {
  [K in (typeof AD_SOURCE_DEFINITIONS)[number]['key']]: Extract<
    (typeof AD_SOURCE_DEFINITIONS)[number],
    { key: K }
  >['value'];
};

export type TAdSource = (typeof AD_SOURCE_DEFINITIONS)[number]['value'];

export const AD_SOURCE_VALUES = AD_SOURCE_DEFINITIONS.map((s) => s.value) as [
  TAdSource,
  ...TAdSource[],
];

// Sources an alert can select (disabled platforms stay in the db enum and the worker)
export const ENABLED_AD_SOURCE_DEFINITIONS = AD_SOURCE_DEFINITIONS.filter(
  (s) => s.isEnabled,
);

export const ENABLED_AD_SOURCE_VALUES = ENABLED_AD_SOURCE_DEFINITIONS.map(
  (s) => s.value,
) as [TAdSource, ...TAdSource[]];

// Default sources for an alert (and for alerts created before multi-source)
export const DEFAULT_ALERT_SOURCES: TAdSource[] = [EAdSource.LEBONCOIN];

export const getAdSourceConfig = (source: TAdSource) => {
  const config = AD_SOURCE_DEFINITIONS.find((s) => s.value === source);
  if (!config) throw new Error(`Invalid ad source: ${source}`);
  return config;
};

export const getAdSourceLabel = (source: TAdSource): string => {
  return getAdSourceConfig(source).label;
};

/**
 * Alert criteria that are not available on every source: an ad from a source
 * that does not provide the underlying data is excluded when the criterion is
 * used. Criteria absent from this map are supported by all sources.
 * - Margin mode needs an argus estimate: Leboncoin gives a price range,
 *   LaCentrale a single quotation; AutoScout24 and ParuVendu give nothing.
 * - Vehicle state: Leboncoin details it, AutoScout24 only reports whether the
 *   car is currently damaged (enough to exclude wrecks); LaCentrale and
 *   ParuVendu give nothing.
 * - Owner type (private / pro): Leboncoin, AutoScout24 and LaCentrale flag the
 *   seller; ParuVendu does not.
 */
export const FILTER_SOURCE_AVAILABILITY = {
  marginMin: [EAdSource.LEBONCOIN, EAdSource.LACENTRALE],
  vehicleState: [EAdSource.LEBONCOIN, EAdSource.AUTOSCOUT24],
  ownerType: [EAdSource.LEBONCOIN, EAdSource.AUTOSCOUT24, EAdSource.LACENTRALE],
} as const satisfies Record<string, readonly TAdSource[]>;

export type TSourceRestrictedFilter = keyof typeof FILTER_SOURCE_AVAILABILITY;

/**
 * Returns the selected sources that do NOT support the given criterion.
 * Empty array = the criterion works on every selected source.
 */
export const getSourcesMissingFilter = (
  filterKey: TSourceRestrictedFilter,
  selectedSources: TAdSource[],
): TAdSource[] => {
  const supported: readonly TAdSource[] = FILTER_SOURCE_AVAILABILITY[filterKey];
  return selectedSources.filter((source) => !supported.includes(source));
};
