import {
  and,
  eq,
  isNull,
  locations as locationsTable,
  TAdInsert,
} from "@alertdeals/db";
import {
  EAdGoodDeal,
  EAdOwnerType,
  EAdSource,
  parsePhoneNumberWithError,
  TAdOwnerType,
} from "@alertdeals/shared";
import { customParseInt } from "../../utils/general.utils.js";
import {
  computeMarketComparison,
  createUnmappedCollector,
  DEFAULT_DRIVING_LICENCE_ID,
  DEFAULT_LOCATION_ID,
  DEFAULT_VEHICLE_STATE_ID,
  resolveBrandId,
  resolveModelId,
  resolveOwnerType,
  toDbDate,
} from "./shared.mapper.js";
import { TAdMapper } from "./types.js";

// Leboncoin `owner_type` values
const OWNER_TYPES: Record<string, TAdOwnerType> = {
  private: EAdOwnerType.PRIVATE,
  pro: EAdOwnerType.PRO,
};

export type TAdFromLeboncoin = {
  id: string;
  object: string;
  cluster: string;
  run: string;
  DPE: null | string;
  DPE_int: null | number;
  DPE_string: null | string;
  GES: null | string;
  GES_int: null | number;
  GES_string: null | string;
  ad_type: string;
  annonce_id: string;
  api_key: string;
  area: null | string;
  capacity: null | number;
  category_name: string;
  charges_included: null | boolean;
  city: string;
  continuous_top_ads: boolean;
  currency: string;
  custom_ref: null | string;
  department: string;
  description: string;
  detailed_time: null | string;
  details: {
    Marque: string;
    Permis: string;
    Couleur: string;
    Modèle: string;
    Sellerie: string;
    Carburant: string;
    Kilométrage: string;
    Équipements: string;
    "Puissance DIN": string;
    "Année modèle": string;
    "Nombre de portes": string;
    "Boîte de vitesse": string;
    Caractéristiques: string;
    "Puissance fiscale": string;
    "Type de véhicule": string;
    "Nombre de place(s)": string;
    "Date de première mise en circulation": string;
    "Date de fin de validité du contrôle technique": string;
    "État du véhicule": string;
    Cylindrée: string;
    Type: string;
  };
  district: null | string;
  expiration_date: string;
  filling_details: { phone: { filling_date: string } };
  first_publication_date: string;
  floor: null | number;
  furnished: null | boolean;
  gallery: boolean;
  has_online_shop: boolean;
  has_option: boolean;
  has_phone: boolean;
  has_swimming_pool: null | boolean;
  is_active: null | boolean;
  is_boosted: boolean;
  is_deactivated: null | boolean;
  is_detailed: null | boolean;
  is_exclusive: null | boolean;
  is_mobile: null | boolean;
  land_plot_area: null | number;
  last_publication_date: string;
  lat: string;
  lng: string;
  mail: null | string;
  more_details: {
    fuel: string;
    brand: string;
    doors: string;
    model: string;
    seats: string;
    gearbox: string;
    mileage: string;
    regdate: string;
    is_import: string;
    horsepower: string;
    u_car_brand: string;
    u_car_model: string;
    vehicle_vsp: string;
    rating_count: string;
    rating_score: string;
    vehicle_type: string;
    issuance_date: string;
    vehicule_color: string;
    argus_object_id: string;
    horse_power_din: string;
    ad_warranty_type: string;
    vehicle_upholstery: string;
    profile_picture_url: string;
    vehicle_interior_specs: string;
    vehicle_specifications: string;
    licence_plate_available: string;
    vehicle_is_eligible_p2p: string;
    vehicle_technical_inspection_a: string;
    vehicle_history_report_public_url: string;
    old_price: string;
    car_price_max: string;
    car_price_min: string;
    car_price_positioning: string;
  };
  no_salesmen: boolean;
  online_shop_url: null | string;
  owner_name: string;
  owner_siren: null | string;
  owner_store_id: string;
  owner_type: string;
  phone: string;
  phone_from_user: null | string;
  photosup: boolean;
  picture: string;
  pictures: string;
  postal_code: string;
  price: number;
  price_per_square_meter: null | number;
  real_estate_type: null | string;
  ref: null | string;
  region: string;
  room_count: null | number;
  scraping_time: string;
  sleepingroom_count: null | number;
  source: string;
  square_metter_price: null | number;
  status_code: null | number;
  sub_toplist: boolean;
  title: string;
  urgent: boolean;
  url: string;
  user_id: string;
};

/**
 * Maps a single Lobstr ad payload to our schema's TAdInsert.
 * - Computes `isLowPrice`, `goodDealName`, and the 4 margin fields.
 * - Looks up FKs via the prebuilt reference Maps; auto-creates missing brands/models.
 */
export const mapLeboncoinAd: TAdMapper<TAdFromLeboncoin> = async (
  db,
  ad,
  referenceData,
) => {
  const { details: adDetails, more_details: adMoreDetails } = ad;

  const priceMax = customParseInt(adMoreDetails.car_price_max);
  const priceMin = customParseInt(adMoreDetails.car_price_min);
  const marketComparison = computeMarketComparison(ad.price, priceMin, priceMax);
  const unmapped = createUnmappedCollector();

  const adData: Partial<TAdInsert> = {
    source: EAdSource.LEBONCOIN,
    originalAdId: ad.annonce_id,
    title: ad.title,
    description: ad.description,
    price: ad.price,
    url: ad.url,
    hasPhone: ad.phone ? true : false,
    phoneNumber: ad.phone
      ? parsePhoneNumberWithError(ad.phone, "FR")?.number
      : null,
    picture: ad.picture,
    pictures: ad.pictures.split(","),
    initialPublicationDate: toDbDate(ad.first_publication_date),
    lastPublicationDate: toDbDate(ad.last_publication_date),
    ownerName: ad.owner_name,
    ownerType: resolveOwnerType(unmapped, OWNER_TYPES, ad.owner_type),
    hasBeenBoosted: ad.is_boosted,
    isUrgent: ad.urgent,
    modelYear: customParseInt(adDetails["Année modèle"]),
    dinPower: customParseInt(adMoreDetails.horse_power_din),
    entryYear: customParseInt(
      adDetails["Date de première mise en circulation"].slice(-4),
    ),
    hasBeenReposted: ad.last_publication_date
      ? ad.first_publication_date !== ad.last_publication_date
      : false,
    mileage: customParseInt(adDetails["Kilométrage"]),
    priceHasDropped: adMoreDetails.old_price
      ? ad.price < parseInt(adMoreDetails.old_price)
      : false,
    ...marketComparison,
    equipments: adMoreDetails.vehicle_interior_specs || null,
    otherSpecifications: adMoreDetails.vehicle_specifications,
    technicalInspectionYear: customParseInt(
      adDetails["Date de fin de validité du contrôle technique"],
    ),
  };

  // FK lookups via reference Maps; brand/model auto-create if unseen.
  adData.typeId = referenceData.adTypes.get(ad.category_name) || 1;
  adData.brandId = await resolveBrandId(db, referenceData, adDetails["Marque"]);
  adData.modelId = adData.brandId
    ? await resolveModelId(
        db,
        referenceData,
        adMoreDetails.model,
        adData.brandId,
      )
    : null;
  adData.marketPositionId =
    referenceData.marketPositions.get(adMoreDetails.car_price_positioning) ||
    null;
  adData.locationId =
    referenceData.zipcodes.get(ad.postal_code) || DEFAULT_LOCATION_ID;

  if (ad.region && adData.locationId) {
    await db
      .update(locationsTable)
      .set({ region: ad.region })
      .where(
        and(
          eq(locationsTable.id, adData.locationId),
          isNull(locationsTable.region),
        ),
      );
  }
  adData.gearBoxId = unmapped.resolve(
    "gearbox",
    referenceData.gearBoxes,
    null,
    adDetails["Boîte de vitesse"],
  );
  adData.drivingLicenceId =
    referenceData.drivingLicences.get(adDetails["Permis"]) ||
    DEFAULT_DRIVING_LICENCE_ID;
  adData.fuelId = unmapped.resolve(
    "fuel",
    referenceData.fuels,
    null,
    adMoreDetails.fuel,
  );
  adData.vehicleSeatsId = unmapped.resolve(
    "seats",
    referenceData.vehicleSeats,
    null,
    adDetails["Nombre de place(s)"],
  );
  adData.vehicleStateId =
    referenceData.vehicleStates.get(adDetails["État du véhicule"]) ||
    DEFAULT_VEHICLE_STATE_ID;
  adData.subtypeId = unmapped.resolve(
    "vehicleType",
    referenceData.adSubTypes,
    null,
    adDetails["Type de véhicule"],
  );
  adData.unmappedValues = unmapped.result();

  // Good-deal classification: trust Lobstr's positioning, but also flag VERY_GOOD when
  // the ad is priced at <= 85% of the market floor (catches deals Lobstr underrates).
  const carPricePositioning = adMoreDetails.car_price_positioning;
  if (
    carPricePositioning === EAdGoodDeal.VERY_GOOD ||
    (priceMin && ad.price <= 0.85 * priceMin)
  ) {
    adData.goodDealName = EAdGoodDeal.VERY_GOOD;
  } else if (
    carPricePositioning === EAdGoodDeal.GOOD ||
    (priceMin && ad.price <= priceMin)
  ) {
    adData.goodDealName = EAdGoodDeal.GOOD;
  }

  return adData as TAdInsert;
};
