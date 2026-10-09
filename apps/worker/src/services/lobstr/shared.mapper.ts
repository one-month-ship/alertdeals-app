import {
  and,
  brands as brandsTable,
  eq,
  TAdInsert,
  TAdReferenceData,
  vehicleModels as vehicleModelsTable,
} from "@alertdeals/db";
import {
  normalizeReferenceName,
  parsePhoneNumberWithError,
  TAdOwnerType,
} from "@alertdeals/shared";
import { getVehicleModelLookupKey } from "../ad.service.js";
import { BRAND_ALIASES, MODEL_ALIASES } from "./aliases.js";
import { TDBClient } from "./types.js";

// Fallback ids used when a reference value is missing (same as the historical
// Leboncoin mapping)
export const DEFAULT_LOCATION_ID = 1;
export const DEFAULT_DRIVING_LICENCE_ID = 1;
export const DEFAULT_VEHICLE_STATE_ID = 2; // "Non endommagé"
export const DEFAULT_OWNER_NAME = "Vendeur";

/**
 * Canonical reference values (= `lobstr_value` columns seeded in the db).
 * Every source-specific mapper translates its own vocabulary to these.
 */
export const REF = {
  types: {
    CAR: "Voitures",
    MOTORBIKE: "Motos",
    UTILITY: "Utilitaires",
  },
  fuels: {
    PETROL: "Essence",
    DIESEL: "Diesel",
    HYBRID: "Hybride",
    ELECTRIC: "Electrique",
    LPG: "GPL",
    CNG: "Gaz naturel (CNG)",
    OTHER: "Autre",
  },
  gearBoxes: {
    MANUAL: "Manuelle",
    AUTOMATIC: "Automatique",
  },
  subTypes: {
    SEDAN: "Berline",
    ESTATE: "Break",
    CONVERTIBLE: "Cabriolet",
    SUV: "4x4, SUV & Crossover",
    CITY_CAR: "Citadine",
    COUPE: "Coupé",
    MPV: "Monospace",
    COMPANY_CAR: "Voiture société, commerciale",
    OTHER: "Autre",
    MOPED: "Cyclomoteur & vélomoteur",
    MOTORBIKE: "Moto",
    SCOOTER: "Scooter",
    QUAD: "Quad",
  },
  vehicleStates: {
    DAMAGED: "Endommagé",
    UNDAMAGED: "Non endommagé",
  },
} as const;

export type TPhoneInfo = {
  phoneNumber: string | null;
  hasPhone: boolean;
};

/**
 * Normalises a raw phone to E.164. Accepts "+33…", "33…" (international
 * without "+") and national formats.
 */
export const parsePhone = (
  raw: string | null | undefined,
  defaultCountry: "FR" = "FR",
): TPhoneInfo => {
  if (!raw) return { phoneNumber: null, hasPhone: false };

  const cleaned = raw.replace(/[\s.\-()]/g, "");
  const candidates = [cleaned];
  // "33451127621" style: international number without the leading "+"
  if (/^\d{10,15}$/.test(cleaned) && !cleaned.startsWith("0")) {
    candidates.unshift(`+${cleaned}`);
  }

  for (const candidate of candidates) {
    try {
      const parsed = parsePhoneNumberWithError(candidate, defaultCountry);
      if (!parsed?.isValid()) continue;
      return { phoneNumber: parsed.number, hasPhone: true };
    } catch {
      // try next candidate
    }
  }

  return { phoneNumber: null, hasPhone: true };
};

/**
 * Same string format as historically stored for `date` columns
 */
export const toDbDate = (value: string | Date | null | undefined): string => {
  const date = value ? new Date(value) : new Date();
  return (Number.isNaN(date.getTime()) ? new Date() : date).toDateString();
};

/**
 * Parses "DD/MM/YYYY" or "DD/MM/YYYY HH:mm" (French formats)
 */
export const parseFrenchDate = (
  value: string | null | undefined,
): Date | null => {
  if (!value) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(`${year}-${month}-${day}`);
};

/**
 * Extracts a 4-digit year from strings like "12/2025", "2024-10-06", "2024"
 */
export const extractYear = (
  value: string | number | null | undefined,
): number | null => {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/(19|20)\d{2}/);
  return match ? parseInt(match[0]) : null;
};

export const normalizeZipcode = (
  value: string | number | null | undefined,
): string | null => {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim().padStart(5, "0");
};

// Same key as the `normalized_name` column computed by Postgres
const normalizeKey = normalizeReferenceName;

/**
 * Looks up a source vocabulary → canonical value dictionary, case-insensitively.
 */
export const translate = (
  dictionary: Record<string, string>,
  value: string | null | undefined,
): string | null => {
  if (!value) return null;
  const key = normalizeKey(value);
  const found = Object.entries(dictionary).find(
    ([k]) => normalizeKey(k) === key,
  );
  return found ? found[1] : null;
};

export const lookupRef = (
  map: Map<string, number>,
  canonicalValue: string | null | undefined,
): number | null => {
  if (!canonicalValue) return null;
  return map.get(canonicalValue) ?? null;
};

/**
 * Collects raw platform values that found no reference match, so they end
 * up in `ads.unmappedValues` for the weekly cleanup.
 */
export const createUnmappedCollector = () => {
  const unmapped: Record<string, string> = {};
  return {
    /**
     * Translates `raw` with `dictionary` then looks it up in `map`;
     * records `raw` under `field` when the chain fails.
     */
    resolve: (
      field: string,
      map: Map<string, number>,
      dictionary: Record<string, string> | null,
      raw: string | null | undefined,
    ): number | null => {
      if (!raw) return null;
      const canonical = dictionary ? translate(dictionary, raw) : raw;
      const id = lookupRef(map, canonical);
      if (id === null) unmapped[field] = raw;
      return id;
    },
    /**
     * Records `raw` under `field` without any lookup, for values that map to
     * an enum rather than a reference table.
     */
    record: (field: string, raw: string): void => {
      unmapped[field] = raw;
    },
    /** Null when everything mapped (keeps the column null = nothing to review) */
    result: (): Record<string, string> | null =>
      Object.keys(unmapped).length > 0 ? unmapped : null,
  };
};

/**
 * Translates a platform's seller-type vocabulary to `ads.ownerType`. An
 * unknown value is recorded for the weekly review and stored as null (=
 * "unknown"), so the owner-type alert filter lets the ad through rather than
 * silently dropping it.
 */
export const resolveOwnerType = (
  unmapped: ReturnType<typeof createUnmappedCollector>,
  dictionary: Record<string, TAdOwnerType>,
  raw: string | null | undefined,
): TAdOwnerType | null => {
  if (!raw) return null;
  const key = normalizeKey(raw);
  const found = Object.entries(dictionary).find(
    ([k]) => normalizeKey(k) === key,
  );
  if (found) return found[1];
  unmapped.record("ownerType", raw);
  return null;
};

/**
 * Market comparison block shared by all mappers: how the ad price sits
 * against the platform's estimate (a [min, max] range for Leboncoin, a single
 * quotation for LaCentrale — pass it as both min and max; null for platforms
 * without an estimate).
 */
export const computeMarketComparison = (
  price: number,
  priceMin: number | null,
  priceMax: number | null,
): Pick<
  TAdInsert,
  | "priceMin"
  | "priceMax"
  | "isLowPrice"
  | "marginAmountMin"
  | "marginAmountMax"
  | "marginPercentageMin"
  | "marginPercentageMax"
> => {
  let isLowPrice = false;
  if (priceMax && priceMin) {
    const priceAmplitude = priceMax - priceMin;
    const thirdOfPriceAmplitude = priceAmplitude / 3;
    isLowPrice = priceMin + thirdOfPriceAmplitude > price;
  }

  // Margins: how much under (positive) or over (negative) the market range
  // this ad sits. Division-by-zero guarded by the `price > 0` check.
  let marginAmountMin: number | null = null;
  let marginAmountMax: number | null = null;
  let marginPercentageMin: number | null = null;
  let marginPercentageMax: number | null = null;
  if (price > 0) {
    if (priceMin !== null) {
      marginAmountMin = priceMin - price;
      marginPercentageMin = marginAmountMin / price;
    }
    if (priceMax !== null) {
      marginAmountMax = priceMax - price;
      marginPercentageMax = marginAmountMax / price;
    }
  }

  return {
    priceMin,
    priceMax,
    isLowPrice,
    marginAmountMin,
    marginAmountMax,
    marginPercentageMin,
    marginPercentageMax,
  };
};

const findAlias = (
  aliases: Record<string, string>,
  value: string,
): string | null => {
  const key = normalizeKey(value);
  const found = Object.entries(aliases).find(([k]) => normalizeKey(k) === key);
  return found ? found[1] : null;
};

/**
 * Resolution order: exact lobstr value → alias → normalized name → create.
 * The normalized name is a Postgres generated column with a unique index, so
 * a spelling variant can never end up as a second row. Created rows are
 * flagged `needsReview` for the weekly manual cleanup.
 */
export const resolveBrandId = async (
  db: TDBClient,
  referenceData: TAdReferenceData,
  rawBrand: string | null | undefined,
): Promise<number | null> => {
  if (!rawBrand) return null;
  const trimmed = rawBrand.trim();
  if (!trimmed) return null;

  const exact = referenceData.brands.get(trimmed);
  if (exact) return exact;

  const candidate = findAlias(BRAND_ALIASES, trimmed) ?? trimmed;
  const normalizedName = normalizeKey(candidate);
  const normalized = referenceData.brandsByNormalizedName.get(normalizedName);
  if (normalized) return normalized;

  // Brands are stored uppercase (see seed)
  const lobstrValue = candidate.toUpperCase();
  const [inserted] = await db
    .insert(brandsTable)
    .values({ name: lobstrValue, lobstrValue, needsReview: true })
    .onConflictDoNothing()
    .returning({ id: brandsTable.id });

  // Conflict on the normalized name (row created since reference data was
  // loaded): fetch the existing one instead of failing
  const brandId =
    inserted?.id ??
    (
      await db
        .select({ id: brandsTable.id })
        .from(brandsTable)
        .where(eq(brandsTable.normalizedName, normalizedName))
        .limit(1)
    )[0]?.id;
  if (!brandId) return null;

  referenceData.brands.set(lobstrValue, brandId);
  referenceData.brandsByNormalizedName.set(normalizedName, brandId);
  referenceData.brandNamesById.set(brandId, lobstrValue);
  return brandId;
};

/**
 * Resolution order: exact lobstr value → brand-scoped alias → normalized name → create.
 */
export const resolveModelId = async (
  db: TDBClient,
  referenceData: TAdReferenceData,
  rawModel: string | null | undefined,
  brandId: number,
): Promise<number | null> => {
  if (!rawModel) return null;
  const trimmed = rawModel.trim();
  if (!trimmed) return null;

  // Lookup scoped by brand: model names are not unique across brands
  // (e.g. Peugeot 208 vs Ferrari 208)
  const exact = referenceData.vehicleModels.get(
    getVehicleModelLookupKey(brandId, trimmed),
  );
  if (exact) return exact;

  const brandName = referenceData.brandNamesById.get(brandId);
  const brandAliases = brandName ? MODEL_ALIASES[brandName] : undefined;
  const candidate = (brandAliases && findAlias(brandAliases, trimmed)) ?? trimmed;

  const normalizedName = normalizeKey(candidate);
  const normalizedKey = getVehicleModelLookupKey(brandId, normalizedName);
  const normalized =
    referenceData.vehicleModelsByNormalizedName.get(normalizedKey);
  if (normalized) return normalized;

  const [inserted] = await db
    .insert(vehicleModelsTable)
    .values({ name: candidate, lobstrValue: candidate, brandId, needsReview: true })
    .onConflictDoNothing()
    .returning({ id: vehicleModelsTable.id });

  const modelId =
    inserted?.id ??
    (
      await db
        .select({ id: vehicleModelsTable.id })
        .from(vehicleModelsTable)
        .where(
          and(
            eq(vehicleModelsTable.brandId, brandId),
            eq(vehicleModelsTable.normalizedName, normalizedName),
          ),
        )
        .limit(1)
    )[0]?.id;
  if (!modelId) return null;

  referenceData.vehicleModels.set(
    getVehicleModelLookupKey(brandId, candidate),
    modelId,
  );
  referenceData.vehicleModelsByNormalizedName.set(normalizedKey, modelId);
  return modelId;
};
