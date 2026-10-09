import { TAdInsert } from "@alertdeals/db";
import { EAdSource } from "@alertdeals/shared";
import {
  computeMarketComparison,
  createUnmappedCollector,
  DEFAULT_DRIVING_LICENCE_ID,
  DEFAULT_LOCATION_ID,
  DEFAULT_OWNER_NAME,
  DEFAULT_VEHICLE_STATE_ID,
  lookupRef,
  normalizeZipcode,
  parseFrenchDate,
  parsePhone,
  REF,
  resolveBrandId,
  resolveModelId,
  toDbDate,
  translate,
} from "./shared.mapper.js";
import { TAdMapper } from "./types.js";

/**
 * Raw ParuVendu result as returned by the Lobstr "ParuVendu" squid
 * (Export Listings + Get Annonce Details). The squid is shared with real
 * estate listings, hence the non-vehicle fields.
 */
export type TAdFromParuVendu = {
  section: string | null; // "voiture-occasion" | "moto" | "prestige" | "immobilier"...
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  fuel_type: string | null; // "Essence" | "Diesel" | "Hybride"...
  gearbox: string | null; // "Manuelle" | "Automatique"
  phone: string | null;
  location: string | null;
  postal_code: number | string | null;
  annonce_type: string | null;
  title: string | null;
  picture: string[] | null;
  room_count: number | null;
  area: number | null;
  price: number | null;
  currency: string | null;
  description: string | null;
  description_preview: string | null;
  reference: string | null; // "ParuVendu WI176922425"
  updated_at: string | null; // "03/03/2026 11:22"
  features: string[] | null;
  seller_name: string | null;
  seller_url: string | null;
  seller_ads_count: number | null;
  asset_type: string | null;
  last_publication_date: string | null; // "03/03/2026"
  dpe_greenhouse: string | null;
  dpe_energy: string | null;
  list_infos: string | null;
  url: string;
};

const FUELS: Record<string, string> = {
  Essence: REF.fuels.PETROL,
  Diesel: REF.fuels.DIESEL,
  Hybride: REF.fuels.HYBRID,
  "Hybride rechargeable": REF.fuels.HYBRID,
  Electrique: REF.fuels.ELECTRIC,
  Électrique: REF.fuels.ELECTRIC,
  GPL: REF.fuels.LPG,
  GNV: REF.fuels.CNG,
  Autre: REF.fuels.OTHER,
};

const GEAR_BOXES: Record<string, string> = {
  Manuelle: REF.gearBoxes.MANUAL,
  Mécanique: REF.gearBoxes.MANUAL,
  Automatique: REF.gearBoxes.AUTOMATIC,
};

// Sections of the ParuVendu site that hold vehicle listings
const TYPES: Record<string, string> = {
  "voiture-occasion": REF.types.CAR,
  voiture: REF.types.CAR,
  auto: REF.types.CAR,
  prestige: REF.types.CAR,
  "voiture-collection": REF.types.CAR,
  moto: REF.types.MOTORBIKE,
  "moto-occasion": REF.types.MOTORBIKE,
  scooter: REF.types.MOTORBIKE,
  utilitaire: REF.types.UTILITY,
  "utilitaire-occasion": REF.types.UTILITY,
  camion: REF.types.UTILITY,
};

const getOriginalAdId = (ad: TAdFromParuVendu): string => {
  const fromReference = ad.reference?.replace(/^ParuVendu\s+/i, "").trim();
  if (fromReference) return fromReference;
  // Listing id is the last path segment of the url
  const fromUrl = ad.url.replace(/\/+$/, "").split("/").pop();
  return fromUrl || ad.url;
};

export const mapParuVenduAd: TAdMapper<TAdFromParuVendu> = async (
  db,
  ad,
  referenceData,
) => {
  const typeValue = translate(TYPES, ad.section);
  // Skip real estate & other non-vehicle sections
  if (!typeValue) return null;
  if (ad.price === null || ad.price === undefined) return null;

  const phone = parsePhone(ad.phone);
  const unmapped = createUnmappedCollector();
  const pictures = ad.picture ?? [];
  const publicationDate =
    parseFrenchDate(ad.last_publication_date) ??
    parseFrenchDate(ad.updated_at);
  const zipcode = normalizeZipcode(ad.postal_code);

  const adData: Partial<TAdInsert> = {
    source: EAdSource.PARUVENDU,
    originalAdId: getOriginalAdId(ad),
    title: ad.title || [ad.make, ad.model, ad.year].filter(Boolean).join(" "),
    description: ad.description ?? ad.description_preview,
    price: ad.price,
    url: ad.url,
    ...phone,
    picture: pictures[0] ?? null,
    pictures,
    initialPublicationDate: toDbDate(publicationDate),
    lastPublicationDate: toDbDate(publicationDate),
    ownerName: ad.seller_name || DEFAULT_OWNER_NAME,
    // ParuVendu does not say whether the seller is a pro
    ownerType: null,
    hasBeenBoosted: false,
    isUrgent: false,
    modelYear: ad.year,
    entryYear: null,
    hasBeenReposted: false,
    mileage: ad.mileage,
    priceHasDropped: false,
    // No market estimate on ParuVendu
    ...computeMarketComparison(ad.price, null, null),
    dinPower: null,
    equipments: ad.features?.length ? ad.features.join(", ") : null,
    otherSpecifications: ad.list_infos,
    technicalInspectionYear: null,
  };

  adData.typeId = lookupRef(referenceData.adTypes, typeValue) || 1;
  adData.brandId = await resolveBrandId(db, referenceData, ad.make);
  adData.modelId = adData.brandId
    ? await resolveModelId(db, referenceData, ad.model, adData.brandId)
    : null;
  adData.marketPositionId = null;
  adData.locationId =
    (zipcode && referenceData.zipcodes.get(zipcode)) || DEFAULT_LOCATION_ID;
  adData.gearBoxId = unmapped.resolve(
    "gearbox",
    referenceData.gearBoxes,
    GEAR_BOXES,
    ad.gearbox,
  );
  adData.drivingLicenceId = DEFAULT_DRIVING_LICENCE_ID;
  adData.fuelId = unmapped.resolve("fuel", referenceData.fuels, FUELS, ad.fuel_type);
  adData.vehicleSeatsId = null;
  adData.vehicleStateId = DEFAULT_VEHICLE_STATE_ID;
  adData.subtypeId = null;
  adData.unmappedValues = unmapped.result();

  return adData as TAdInsert;
};
