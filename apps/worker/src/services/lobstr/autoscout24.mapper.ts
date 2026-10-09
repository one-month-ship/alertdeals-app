import { TAdInsert } from "@alertdeals/db";
import {
  EAdGoodDeal,
  EAdOwnerType,
  EAdSource,
  TAdOwnerType,
} from "@alertdeals/shared";
import {
  computeMarketComparison,
  createUnmappedCollector,
  DEFAULT_DRIVING_LICENCE_ID,
  DEFAULT_LOCATION_ID,
  DEFAULT_OWNER_NAME,
  DEFAULT_VEHICLE_STATE_ID,
  extractYear,
  lookupRef,
  normalizeZipcode,
  parsePhone,
  REF,
  resolveBrandId,
  resolveModelId,
  resolveOwnerType,
  toDbDate,
  translate,
} from "./shared.mapper.js";
import { TAdMapper } from "./types.js";

/**
 * Raw AutoScout24 result as returned by the Lobstr "AutoScout24" squid
 * (Export Listings + Get Listing Details)
 */
export type TAdFromAutoScout24 = {
  listing_id: string;
  url: string;
  title: string | null;
  subtitle: string | null;
  make: string | null;
  model: string | null;
  price: number | null;
  currency: string | null;
  mileage: number | null;
  fuel_type: string | null;
  first_registration: string | null; // "12/2025"
  power: string | null; // "151 kW (205 hp)"
  seller_type: string | null; // "Dealer" | "Private"
  seller_name: string | null;
  location: string | null;
  postal_code: string | null;
  description: string | null;
  phone: string | null;
  price_label: string | null;
  gearbox: string | null;
  body_type: string | null;
  doors: number | null;
  seats: number | null;
  displacement_cc: number | null;
  cylinders: number | null;
  weight_kg: number | null;
  emission_class: string | null;
  emissions_sticker: string | null;
  fuel_consumption: string | null;
  drivetrain: string | null;
  number_of_previous_owners: number | null;
  general_inspection: string | null; // "11/2028"
  last_service: string | null;
  production_date: string | null;
  equipment: string[] | null;
  colour: string | null;
  manufacturer_colour: string | null;
  paint: string | null;
  upholstery: string | null;
  upholstery_colour: string | null;
  version: string | null;
  image_urls: string[] | null;
  image_count: number | null;
  vehicle_type: string | null; // "Car" | "Motorcycle" | "Van" | "Truck"
  listing_country: string | null;
  position: number | null;
  first_online_date: string | null;
  // Raw scraped page data; carries the numeric price evaluation, the damage
  // flag and the ad tier (only present on part of the listings)
  functions?: {
    json_data?: {
      price?: { priceEvaluation?: number | null } | null;
      vehicle?: { isCurrentlyDamaged?: boolean | null } | null;
      adTier?: string | null;
    } | null;
  } | null;
};

// Every listing is "T10" unless the seller paid for more visibility
const BASE_AD_TIER = "T10";
// priceEvaluation 1 (très bonne affaire) and 2 (bonne affaire) are below market
const LOW_PRICE_MAX_EVALUATION = 2;

// The squid scrapes autoscout24.fr: values come in French; EN kept as a
// safety net since the doc examples were English
const FUELS: Record<string, string> = {
  Essence: REF.fuels.PETROL,
  Électrique: REF.fuels.ELECTRIC,
  Electrique: REF.fuels.ELECTRIC,
  Hybride: REF.fuels.HYBRID,
  "Hybride rechargeable": REF.fuels.HYBRID,
  "Électrique/Essence": REF.fuels.HYBRID,
  "Électrique/Diesel": REF.fuels.HYBRID,
  GPL: REF.fuels.LPG,
  GNV: REF.fuels.CNG,
  "Gaz naturel": REF.fuels.CNG,
  Hydrogène: REF.fuels.OTHER,
  Éthanol: REF.fuels.OTHER,
  Autres: REF.fuels.OTHER,
  Autre: REF.fuels.OTHER,
  Petrol: REF.fuels.PETROL,
  Gasoline: REF.fuels.PETROL,
  Super: REF.fuels.PETROL,
  Diesel: REF.fuels.DIESEL,
  Electric: REF.fuels.ELECTRIC,
  Hybrid: REF.fuels.HYBRID,
  "Electric/Gasoline": REF.fuels.HYBRID,
  "Electric/Petrol": REF.fuels.HYBRID,
  "Electric/Diesel": REF.fuels.HYBRID,
  "Plug-in Hybrid": REF.fuels.HYBRID,
  LPG: REF.fuels.LPG,
  CNG: REF.fuels.CNG,
  "Natural Gas": REF.fuels.CNG,
  Hydrogen: REF.fuels.OTHER,
  Ethanol: REF.fuels.OTHER,
  Others: REF.fuels.OTHER,
  Other: REF.fuels.OTHER,
};

const GEAR_BOXES: Record<string, string> = {
  "Boîte manuelle": REF.gearBoxes.MANUAL,
  Manuelle: REF.gearBoxes.MANUAL,
  "Boîte automatique": REF.gearBoxes.AUTOMATIC,
  Automatique: REF.gearBoxes.AUTOMATIC,
  "Semi-automatique": REF.gearBoxes.AUTOMATIC,
  Manual: REF.gearBoxes.MANUAL,
  "Manual gearbox": REF.gearBoxes.MANUAL,
  Automatic: REF.gearBoxes.AUTOMATIC,
  "Semi-automatic": REF.gearBoxes.AUTOMATIC,
};

// `seller_type` values seen on autoscout24.fr and in the squid doc (EN)
const OWNER_TYPES: Record<string, TAdOwnerType> = {
  Dealer: EAdOwnerType.PRO,
  Professionnel: EAdOwnerType.PRO,
  Professional: EAdOwnerType.PRO,
  Pro: EAdOwnerType.PRO,
  Private: EAdOwnerType.PRIVATE,
  PrivateSeller: EAdOwnerType.PRIVATE,
  "Private seller": EAdOwnerType.PRIVATE,
  Particulier: EAdOwnerType.PRIVATE,
};

const TYPES: Record<string, string> = {
  Car: REF.types.CAR,
  Motorcycle: REF.types.MOTORBIKE,
  Motorbike: REF.types.MOTORBIKE,
  Van: REF.types.UTILITY,
  Truck: REF.types.UTILITY,
  Transporter: REF.types.UTILITY,
};

const SUB_TYPES: Record<string, string> = {
  Berline: REF.subTypes.SEDAN,
  Break: REF.subTypes.ESTATE,
  Cabriolet: REF.subTypes.CONVERTIBLE,
  "SUV/4x4/Pick-up": REF.subTypes.SUV,
  "SUV/4x4/Pick-Up": REF.subTypes.SUV,
  "Petite voiture": REF.subTypes.CITY_CAR,
  Citadine: REF.subTypes.CITY_CAR,
  Coupé: REF.subTypes.COUPE,
  Monospace: REF.subTypes.MPV,
  Utilitaire: REF.subTypes.COMPANY_CAR,
  Autre: REF.subTypes.OTHER,
  Sedan: REF.subTypes.SEDAN,
  Saloon: REF.subTypes.SEDAN,
  "Station wagon": REF.subTypes.ESTATE,
  Estate: REF.subTypes.ESTATE,
  Convertible: REF.subTypes.CONVERTIBLE,
  Cabrio: REF.subTypes.CONVERTIBLE,
  "SUV/Off-Road/Pick-Up": REF.subTypes.SUV,
  SUV: REF.subTypes.SUV,
  "Off-Road": REF.subTypes.SUV,
  Compact: REF.subTypes.CITY_CAR,
  "Small car": REF.subTypes.CITY_CAR,
  Coupe: REF.subTypes.COUPE,
  Van: REF.subTypes.MPV,
  Minibus: REF.subTypes.MPV,
  Minivan: REF.subTypes.MPV,
  Transporter: REF.subTypes.COMPANY_CAR,
  Other: REF.subTypes.OTHER,
  Scooter: REF.subTypes.SCOOTER,
  Quad: REF.subTypes.QUAD,
};

/**
 * AutoScout24 price evaluation scale (functions.json_data.price.priceEvaluation,
 * mirrored by tracking.priceLabel): 1 super-price, 2 good-price, 3 fair-price,
 * 4 increased-price, 5 high-price. The numeric value is preferred over the
 * displayed label (locale-proof); the label only serves as fallback.
 */
const PRICE_LABEL_TO_EVALUATION: Record<string, string> = {
  "Super prix": "1",
  "Super price": "1",
  "Très bon prix": "1",
  "Bon prix": "2",
  "Good price": "2",
  "Prix équitable": "3",
  "Prix correct": "3",
  "Fair price": "3",
};

const EVALUATION_TO_GOOD_DEAL: Record<number, string> = {
  1: EAdGoodDeal.VERY_GOOD,
  2: EAdGoodDeal.GOOD,
};

// → market_positions.lobstr_value (same tiers as the Leboncoin positioning)
const EVALUATION_TO_MARKET_POSITION: Record<number, string> = {
  1: "Très bonne affaire",
  2: "Bonne affaire",
  3: "Prix équitable",
  4: "Légèrement supérieur",
  5: "Supérieur au marché",
};

const getPriceEvaluation = (ad: TAdFromAutoScout24): number | null => {
  const fromJson = ad.functions?.json_data?.price?.priceEvaluation;
  if (typeof fromJson === "number") return fromJson;
  const fromLabel = translate(PRICE_LABEL_TO_EVALUATION, ad.price_label);
  return fromLabel ? parseInt(fromLabel) : null;
};

// "50 kW (68 Ch)" → 68
const extractDinPower = (power: string | null | undefined): number | null => {
  if (!power) return null;
  const match = power.match(/\((\d+)\s*(?:Ch|hp|CH)\)/i);
  const value = match?.[1];
  return value ? parseInt(value) : null;
};

export const mapAutoScout24Ad: TAdMapper<TAdFromAutoScout24> = async (
  db,
  ad,
  referenceData,
) => {
  if (ad.price === null || ad.price === undefined) return null;

  const phone = parsePhone(ad.phone);
  const unmapped = createUnmappedCollector();
  const priceEvaluation = getPriceEvaluation(ad);
  const jsonData = ad.functions?.json_data;
  const adTier = jsonData?.adTier ?? null;
  const pictures = ad.image_urls ?? [];
  const firstOnline = ad.first_online_date ?? null;
  // Only the first registration is provided: use its year as the model year
  // so the ad is not excluded by hunts' modelYearMin filter
  const registrationYear = extractYear(ad.first_registration);

  const adData: Partial<TAdInsert> = {
    source: EAdSource.AUTOSCOUT24,
    originalAdId: ad.listing_id,
    title: ad.title || [ad.make, ad.model, ad.version].filter(Boolean).join(" "),
    description: ad.description,
    price: ad.price,
    url: ad.url,
    ...phone,
    picture: pictures[0] ?? null,
    pictures,
    initialPublicationDate: toDbDate(firstOnline),
    lastPublicationDate: toDbDate(firstOnline),
    ownerName: ad.seller_name || DEFAULT_OWNER_NAME,
    ownerType: resolveOwnerType(unmapped, OWNER_TYPES, ad.seller_type),
    hasBeenBoosted: adTier !== null && adTier !== BASE_AD_TIER,
    isUrgent: false,
    modelYear: registrationYear,
    entryYear: registrationYear,
    hasBeenReposted: false,
    mileage: ad.mileage,
    priceHasDropped: false,
    // No market estimate on AutoScout24: no price range, no margins
    ...computeMarketComparison(ad.price, null, null),
    // ...but the price evaluation tells whether the ad sits below the market
    isLowPrice:
      priceEvaluation !== null && priceEvaluation <= LOW_PRICE_MAX_EVALUATION,
    dinPower: extractDinPower(ad.power),
    equipments: ad.equipment?.length ? ad.equipment.join(", ") : null,
    otherSpecifications:
      [ad.power, ad.drivetrain, ad.emission_class, ad.colour]
        .filter(Boolean)
        .join(" · ") || null,
    technicalInspectionYear: extractYear(ad.general_inspection),
    goodDealName:
      priceEvaluation !== null
        ? (EVALUATION_TO_GOOD_DEAL[priceEvaluation] ?? null)
        : null,
  };

  adData.typeId =
    unmapped.resolve("vehicleType", referenceData.adTypes, TYPES, ad.vehicle_type) ||
    lookupRef(referenceData.adTypes, REF.types.CAR) ||
    1;
  adData.brandId = await resolveBrandId(db, referenceData, ad.make);
  adData.modelId = adData.brandId
    ? await resolveModelId(db, referenceData, ad.model, adData.brandId)
    : null;
  adData.marketPositionId =
    priceEvaluation !== null
      ? lookupRef(
          referenceData.marketPositions,
          EVALUATION_TO_MARKET_POSITION[priceEvaluation],
        )
      : null;
  adData.locationId =
    (normalizeZipcode(ad.postal_code) &&
      referenceData.zipcodes.get(normalizeZipcode(ad.postal_code)!)) ||
    DEFAULT_LOCATION_ID;
  adData.gearBoxId = unmapped.resolve(
    "gearbox",
    referenceData.gearBoxes,
    GEAR_BOXES,
    ad.gearbox,
  );
  adData.drivingLicenceId = DEFAULT_DRIVING_LICENCE_ID;
  adData.fuelId = unmapped.resolve("fuel", referenceData.fuels, FUELS, ad.fuel_type);
  adData.vehicleSeatsId = unmapped.resolve(
    "seats",
    referenceData.vehicleSeats,
    null,
    ad.seats ? (ad.seats >= 7 ? "7 ou plus" : String(ad.seats)) : null,
  );
  // Missing flag = not reported as damaged
  adData.vehicleStateId =
    lookupRef(
      referenceData.vehicleStates,
      jsonData?.vehicle?.isCurrentlyDamaged
        ? REF.vehicleStates.DAMAGED
        : REF.vehicleStates.UNDAMAGED,
    ) ?? DEFAULT_VEHICLE_STATE_ID;
  adData.subtypeId = unmapped.resolve(
    "bodyType",
    referenceData.adSubTypes,
    SUB_TYPES,
    ad.body_type,
  );
  adData.unmappedValues = unmapped.result();

  return adData as TAdInsert;
};
