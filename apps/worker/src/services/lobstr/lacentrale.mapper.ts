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
 * Raw LaCentrale result as returned by the Lobstr "LaCentrale" squid
 * (Export Cars + Get Listing Details). Only the fields we use are typed.
 */
export type TAdFromLaCentrale = {
  reference: string;
  listing_url: string;
  price: number | null;
  photo_url: string | null;
  pictures_count: number | null;
  make: string | null;
  model: string | null;
  detailed_model: string | null;
  commercial_name: string | null;
  version: string | null;
  trim_level: string | null;
  motorization: string | null;
  year: number | null;
  mileage: number | null;
  energy: string | null; // "ESSENCE" | "DIESEL" | ...
  gearbox: string | null; // "AUTO" | "MANUELLE"
  doors: number | null;
  category: string | null; // "COUPE" | "BERLINE" | ...
  family: string | null; // "AUTO" | "MOTO" | "UTILITAIRE"
  external_color: string | null;
  customer_type: string | null; // "PRO" | "PART"
  contact_name: string | null;
  display_phone: string | null; // "33451127621"
  country: string | null;
  visit_place: string | null; // department only
  is_new: boolean | null;
  all_photos: string[] | null;
  good_deal_badge: string | null; // "VERY_GOOD_DEAL" | "GOOD_DEAL" | "FAIR_DEAL" | "BAD_DEAL"
  first_online_date: string | null;
  last_update: string | null;
  equipment_list: string[] | null;
  all_characteristics: {
    vehicle?: {
      category?: string | null;
      seatingCapacity?: number | null;
      firstTrafficDate?: string | null;
    } | null;
    classified?: {
      zipCode?: string | null;
      refinedQuotation?: number | null;
      description?: string | null;
      goodDealBadge?: string | null;
    } | null;
  } | null;
  options_list: string[] | null;
  seller_address: string | null;
  seller_postal_code: string | null;
  seller_name: string | null;
  seller_comment: string | null;
  engine_power_hp: number | null;
  number_of_seats: number | null;
  first_traffic_date: string | null; // "2024-10-06"
  critair_level: string | null;
  euro_standard: string | null;
  price_variation: {
    prices?: {
      current?: number | null;
      initial?: number | null;
      isDropping?: boolean | null;
    } | null;
  } | null;
  is_first_hand: boolean | null;
  number_of_owners: number | null;
};

const FUELS: Record<string, string> = {
  ESSENCE: REF.fuels.PETROL,
  DIESEL: REF.fuels.DIESEL,
  HYBRIDE: REF.fuels.HYBRID,
  HYBRIDE_ESSENCE: REF.fuels.HYBRID,
  HYBRIDE_DIESEL: REF.fuels.HYBRID,
  HYBRIDE_RECHARGEABLE: REF.fuels.HYBRID,
  HYBRID: REF.fuels.HYBRID,
  ELECTRIQUE: REF.fuels.ELECTRIC,
  ELECTRIC: REF.fuels.ELECTRIC,
  GPL: REF.fuels.LPG,
  GNV: REF.fuels.CNG,
  CNG: REF.fuels.CNG,
  AUTRE: REF.fuels.OTHER,
};

const GEAR_BOXES: Record<string, string> = {
  AUTO: REF.gearBoxes.AUTOMATIC,
  AUTOMATIQUE: REF.gearBoxes.AUTOMATIC,
  MANUELLE: REF.gearBoxes.MANUAL,
  MANUAL: REF.gearBoxes.MANUAL,
  MECANIQUE: REF.gearBoxes.MANUAL,
};

// LaCentrale `customer_type` values
const OWNER_TYPES: Record<string, TAdOwnerType> = {
  PRO: EAdOwnerType.PRO,
  PROFESSIONNEL: EAdOwnerType.PRO,
  PART: EAdOwnerType.PRIVATE,
  PARTICULIER: EAdOwnerType.PRIVATE,
};

const TYPES: Record<string, string> = {
  AUTO: REF.types.CAR,
  MOTO: REF.types.MOTORBIKE,
  UTILITAIRE: REF.types.UTILITY,
  UTILITAIRES: REF.types.UTILITY,
};

const SUB_TYPES: Record<string, string> = {
  SUV_4X4_CROSSOVER: REF.subTypes.SUV,
  TOUS_CHEMINS: REF.subTypes.SUV,
  VOITURE_SOCIETE: REF.subTypes.COMPANY_CAR,
  BERLINE: REF.subTypes.SEDAN,
  BREAK: REF.subTypes.ESTATE,
  CABRIOLET: REF.subTypes.CONVERTIBLE,
  "4X4": REF.subTypes.SUV,
  SUV: REF.subTypes.SUV,
  "4X4_SUV": REF.subTypes.SUV,
  "SUV_4X4": REF.subTypes.SUV,
  CITADINE: REF.subTypes.CITY_CAR,
  COUPE: REF.subTypes.COUPE,
  MONOSPACE: REF.subTypes.MPV,
  SOCIETE: REF.subTypes.COMPANY_CAR,
  UTILITAIRE: REF.subTypes.COMPANY_CAR,
  AUTRE: REF.subTypes.OTHER,
  SCOOTER: REF.subTypes.SCOOTER,
  QUAD: REF.subTypes.QUAD,
};

const GOOD_DEAL_BADGES: Record<string, string> = {
  VERY_GOOD_DEAL: EAdGoodDeal.VERY_GOOD,
  GOOD_DEAL: EAdGoodDeal.GOOD,
};

// Full LaCentrale price-position scale → market_positions.lobstr_value
// (NOT_COMPUTED / null → no position)
const BADGE_TO_MARKET_POSITION: Record<string, string> = {
  VERY_GOOD_DEAL: "Très bonne affaire",
  GOOD_DEAL: "Bonne affaire",
  EQUITABLE_DEAL: "Prix équitable",
  FAIR_DEAL: "Prix équitable",
  BAD_DEAL: "Supérieur au marché",
};

export const mapLaCentraleAd: TAdMapper<TAdFromLaCentrale> = async (
  db,
  ad,
  referenceData,
) => {
  if (ad.price === null || ad.price === undefined) return null;

  const phone = parsePhone(ad.display_phone);
  const unmapped = createUnmappedCollector();
  const pictures = ad.all_photos?.length
    ? ad.all_photos
    : ad.photo_url
      ? [ad.photo_url]
      : [];
  const zipcode = normalizeZipcode(
    ad.seller_postal_code ?? ad.all_characteristics?.classified?.zipCode,
  );
  const quotation = ad.all_characteristics?.classified?.refinedQuotation ?? null;
  const initialPrice = ad.price_variation?.prices?.initial ?? null;
  const dealBadge =
    ad.good_deal_badge ?? ad.all_characteristics?.classified?.goodDealBadge;
  const goodDealName = translate(GOOD_DEAL_BADGES, dealBadge);

  const adData: Partial<TAdInsert> = {
    source: EAdSource.LACENTRALE,
    originalAdId: ad.reference,
    title:
      ad.detailed_model ||
      [ad.make, ad.model, ad.version].filter(Boolean).join(" "),
    description:
      ad.seller_comment ??
      (typeof ad.all_characteristics?.classified?.description === "string"
        ? ad.all_characteristics.classified.description
        : null),
    price: ad.price,
    url: ad.listing_url,
    ...phone,
    picture: pictures[0] ?? null,
    pictures,
    initialPublicationDate: toDbDate(ad.first_online_date),
    lastPublicationDate: toDbDate(ad.last_update ?? ad.first_online_date),
    ownerName: ad.contact_name || ad.seller_name || DEFAULT_OWNER_NAME,
    ownerType: resolveOwnerType(unmapped, OWNER_TYPES, ad.customer_type),
    hasBeenBoosted: false,
    isUrgent: false,
    modelYear: ad.year,
    entryYear: extractYear(
      ad.first_traffic_date ?? ad.all_characteristics?.vehicle?.firstTrafficDate,
    ),
    hasBeenReposted:
      !!ad.last_update &&
      !!ad.first_online_date &&
      toDbDate(ad.last_update) !== toDbDate(ad.first_online_date),
    mileage: ad.mileage,
    priceHasDropped:
      ad.price_variation?.prices?.isDropping ??
      (initialPrice !== null && ad.price < initialPrice),
    // Only a single quotation is provided (no argus range): margins are
    // computed against it, so MARGIN_MIN alerts also work on LaCentrale
    ...computeMarketComparison(ad.price, quotation, quotation),
    isLowPrice: quotation !== null && ad.price < quotation,
    dinPower: ad.engine_power_hp ? Math.round(ad.engine_power_hp) : null,
    equipments: ad.equipment_list?.length ? ad.equipment_list.join(", ") : null,
    otherSpecifications:
      [
        ad.version,
        ad.engine_power_hp ? `${ad.engine_power_hp} ch` : null,
        ad.euro_standard,
        ad.critair_level ? `Crit'Air ${ad.critair_level}` : null,
        ad.external_color,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    technicalInspectionYear: null,
    goodDealName: goodDealName ?? null,
  };

  adData.typeId =
    unmapped.resolve("family", referenceData.adTypes, TYPES, ad.family) ||
    lookupRef(referenceData.adTypes, REF.types.CAR) ||
    1;
  adData.brandId = await resolveBrandId(db, referenceData, ad.make);
  adData.modelId = adData.brandId
    ? await resolveModelId(db, referenceData, ad.model, adData.brandId)
    : null;
  adData.marketPositionId = lookupRef(
    referenceData.marketPositions,
    translate(BADGE_TO_MARKET_POSITION, dealBadge),
  );
  adData.locationId =
    (zipcode && referenceData.zipcodes.get(zipcode)) || DEFAULT_LOCATION_ID;
  adData.gearBoxId = unmapped.resolve(
    "gearbox",
    referenceData.gearBoxes,
    GEAR_BOXES,
    ad.gearbox,
  );
  adData.drivingLicenceId = DEFAULT_DRIVING_LICENCE_ID;
  adData.fuelId = unmapped.resolve("energy", referenceData.fuels, FUELS, ad.energy);
  const seats = ad.number_of_seats ?? ad.all_characteristics?.vehicle?.seatingCapacity;
  adData.vehicleSeatsId = unmapped.resolve(
    "seats",
    referenceData.vehicleSeats,
    null,
    seats ? (seats >= 7 ? "7 ou plus" : String(seats)) : null,
  );
  adData.vehicleStateId = DEFAULT_VEHICLE_STATE_ID;
  adData.subtypeId = unmapped.resolve(
    "category",
    referenceData.adSubTypes,
    SUB_TYPES,
    ad.category ?? ad.all_characteristics?.vehicle?.category,
  );
  adData.unmappedValues = unmapped.result();

  return adData as TAdInsert;
};
