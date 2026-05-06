import {
  ads as adsTable,
  brands as brandsTable,
  getDBAdminClient,
  getTableColumns,
  sql,
  TAdInsert,
  TAdReferenceData,
  vehicleModels as vehicleModelsTable,
} from '@alertdeals/db';
import { EAdGoodDeal, parsePhoneNumberWithError } from '@alertdeals/shared';
import { customParseInt } from '../utils/general.utils.js';
import { fetchAllReferenceData } from './ad.service.js';

const LOBSTR_PLATFORM_FIELD = 'lobstrValue' as const;

// Build the `set` payload for upserts: every column except id/createdAt/originalAdId
// is overwritten with the incoming row's value (`excluded.<col>` in Postgres).
const allColumns = getTableColumns(adsTable);
const { id: _id, createdAt: _createdAt, originalAdId: _origId, ...columnsToUpdate } = allColumns;

const setAdUpdateOnConflict = Object.fromEntries(
  Object.entries(columnsToUpdate).map(([key, column]) => [
    key,
    sql`excluded.${sql.identifier(column.name)}`,
  ]),
);

type TAdFromLobstr = {
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
    'Puissance DIN': string;
    'Année modèle': string;
    'Nombre de portes': string;
    'Boîte de vitesse': string;
    Caractéristiques: string;
    'Puissance fiscale': string;
    'Type de véhicule': string;
    'Nombre de place(s)': string;
    'Date de première mise en circulation': string;
    'Date de fin de validité du contrôle technique': string;
    'État du véhicule': string;
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
 * Entry point called by the BullMQ scraping worker after Lobstr posts a webhook.
 */
export const handleLobstrWebhook = async (runId: string): Promise<void> => {
  try {
    await saveAdsFromLobstr(runId);
  } catch (error) {
    console.error(`[lobstr] failed to ingest run ${runId}`, error);
    throw error;
  }
};

/**
 * Fetches ads from Lobstr's results API for the given run, maps each ad to our schema,
 * and batch-upserts using `original_ad_id` as the dedup key.
 */
const saveAdsFromLobstr = async (runId: string): Promise<void> => {
  const db = getDBAdminClient();

  const fetchedResults = await getResultsFromRun(runId);
  const results = (await fetchedResults.json()) as { data: TAdFromLobstr[] };
  const ads: TAdFromLobstr[] = results.data;

  // Load all lookup tables once into Maps for O(1) lookup during mapping.
  const referenceData = await fetchAllReferenceData(db, LOBSTR_PLATFORM_FIELD);

  const getAdsData = ads.map((ad) => getAdData(db, ad, referenceData));
  const adsToPersistPromise = await Promise.allSettled(getAdsData);

  // Drop any ad whose mapping rejected or produced no `typeId` (which is required).
  const adsToPersist = adsToPersistPromise.reduce<TAdInsert[]>((listOfAds, adPromise) => {
    if (adPromise.status === 'fulfilled' && !!adPromise.value?.typeId) {
      listOfAds = listOfAds.concat(adPromise.value);
    }
    return listOfAds;
  }, []);

  if (adsToPersist.length === 0) {
    console.log(`[lobstr] run ${runId}: no valid ads to persist`);
    return;
  }

  await db
    .insert(adsTable)
    .values(adsToPersist)
    .onConflictDoUpdate({
      target: [adsTable.originalAdId],
      set: setAdUpdateOnConflict,
    })
    .returning();

  console.log(`[lobstr] run ${runId}: upserted ${adsToPersist.length} ads`);
};

const getResultsFromRun = async (runId: string): Promise<Response> => {
  return fetch(
    `https://api.lobstr.io/v1/results?cluster=${process.env.LOBSTR_CLUSTER}&run=${runId}&page=1&page_size=10000`,
    {
      method: 'GET',
      headers: {
        Authorization: `Token ${process.env.LOBSTR_API_KEY}`,
        'Content-Type': 'application/json;charset=UTF-8',
      },
    },
  );
};

/**
 * Maps a single Lobstr ad payload to our schema's TAdInsert.
 * - Computes `isLowPrice`, `goodDealName`, and the 4 margin fields.
 * - Looks up FKs via the prebuilt reference Maps; auto-creates missing brands/models.
 */
const getAdData = async (
  db: ReturnType<typeof getDBAdminClient>,
  ad: TAdFromLobstr,
  referenceData: TAdReferenceData,
): Promise<TAdInsert> => {
  const { details: adDetails, more_details: adMoreDetails } = ad;

  const priceMax = customParseInt(adMoreDetails.car_price_max);
  const priceMin = customParseInt(adMoreDetails.car_price_min);

  let isLowPrice = false;
  if (priceMax && priceMin) {
    const priceAmplitude = priceMax - priceMin;
    const thirdOfPriceAmplitude = priceAmplitude / 3;
    isLowPrice = priceMin + thirdOfPriceAmplitude > ad.price;
  }

  // Margins: how much under (positive) or over (negative) the market range this ad sits.
  // Division-by-zero guarded by the `ad.price > 0` check.
  let marginAmountMin: number | null = null;
  let marginAmountMax: number | null = null;
  let marginPercentageMin: number | null = null;
  let marginPercentageMax: number | null = null;
  if (ad.price > 0) {
    if (priceMin !== null) {
      marginAmountMin = priceMin - ad.price;
      marginPercentageMin = marginAmountMin / ad.price;
    }
    if (priceMax !== null) {
      marginAmountMax = priceMax - ad.price;
      marginPercentageMax = marginAmountMax / ad.price;
    }
  }

  const adData: Partial<TAdInsert> = {
    originalAdId: ad.annonce_id,
    title: ad.title,
    description: ad.description,
    price: ad.price,
    url: ad.url,
    hasPhone: ad.phone ? true : false,
    phoneNumber: ad.phone ? parsePhoneNumberWithError(ad.phone, 'FR')?.number : null,
    picture: ad.picture,
    pictures: ad.pictures.split(','),
    initialPublicationDate: new Date(ad.first_publication_date).toDateString(),
    lastPublicationDate: new Date(ad.last_publication_date).toDateString(),
    ownerName: ad.owner_name,
    hasBeenBoosted: ad.is_boosted,
    isUrgent: ad.urgent,
    modelYear: customParseInt(adDetails['Année modèle']),
    model: adMoreDetails.model,
    entryYear: customParseInt(
      adDetails['Date de première mise en circulation'].slice(-4),
    ),
    hasBeenReposted: ad.last_publication_date
      ? ad.first_publication_date !== ad.last_publication_date
      : false,
    mileage: customParseInt(adDetails['Kilométrage']),
    priceHasDropped: adMoreDetails.old_price
      ? ad.price < parseInt(adMoreDetails.old_price)
      : false,
    priceMin,
    priceMax,
    marginAmountMin,
    marginAmountMax,
    marginPercentageMin,
    marginPercentageMax,
    isLowPrice,
    equipments: adMoreDetails.vehicle_interior_specs || null,
    otherSpecifications: adMoreDetails.vehicle_specifications,
    technicalInspectionYear: customParseInt(
      adDetails['Date de fin de validité du contrôle technique'],
    ),
    acceptSalesmen: !ad.no_salesmen,
    isMobilePhone: ad.is_mobile ?? false,
  };

  // FK lookups via reference Maps; brand/model auto-create if unseen.
  adData.typeId = referenceData.adTypes.get(ad.category_name) || 1;
  adData.brandId = await resolveBrandId(db, referenceData, adDetails['Marque']);
  adData.modelId = adData.brandId
    ? await resolveModelId(db, referenceData, adMoreDetails.model, adData.brandId)
    : null;
  adData.marketPositionId =
    referenceData.marketPositions.get(adMoreDetails.car_price_positioning) || null;
  adData.locationId = referenceData.zipcodes.get(ad.postal_code) || 1;
  adData.gearBoxId = referenceData.gearBoxes.get(adDetails['Boîte de vitesse']) || null;
  adData.drivingLicenceId = referenceData.drivingLicences.get(adDetails['Permis']) || 1;
  adData.fuelId = referenceData.fuels.get(adMoreDetails.fuel) || null;
  adData.vehicleSeatsId =
    referenceData.vehicleSeats.get(adDetails['Nombre de place(s)']) || null;
  adData.vehicleStateId = referenceData.vehicleStates.get(adDetails['État du véhicule']) || 2;
  adData.subtypeId = referenceData.adSubTypes.get(adDetails['Type de véhicule']) || null;

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

/**
 * Returns the brand id for a Lobstr brand value. Inserts a new row if unseen,
 * then caches it in the in-memory reference Map.
 */
const resolveBrandId = async (
  db: ReturnType<typeof getDBAdminClient>,
  referenceData: TAdReferenceData,
  lobstrValue: string | null | undefined,
): Promise<number | null> => {
  if (!lobstrValue) return null;

  const existing = referenceData.brands.get(lobstrValue);
  if (existing) return existing;

  const [inserted] = await db
    .insert(brandsTable)
    .values({ name: lobstrValue, lobstrValue })
    .onConflictDoUpdate({
      target: brandsTable.name,
      set: { lobstrValue: sql`excluded.lobstr_value` },
    })
    .returning({ id: brandsTable.id });

  referenceData.brands.set(lobstrValue, inserted.id);
  return inserted.id;
};

/**
 * Returns the model id for a Lobstr model value scoped to a brand. Auto-creates if unseen.
 */
const resolveModelId = async (
  db: ReturnType<typeof getDBAdminClient>,
  referenceData: TAdReferenceData,
  lobstrValue: string | null | undefined,
  brandId: number,
): Promise<number | null> => {
  if (!lobstrValue) return null;

  const existing = referenceData.vehicleModels.get(lobstrValue);
  if (existing) return existing;

  const [inserted] = await db
    .insert(vehicleModelsTable)
    .values({ name: lobstrValue, lobstrValue, brandId })
    .onConflictDoUpdate({
      target: [vehicleModelsTable.brandId, vehicleModelsTable.name],
      set: { lobstrValue: sql`excluded.lobstr_value` },
    })
    .returning({ id: vehicleModelsTable.id });

  referenceData.vehicleModels.set(lobstrValue, inserted.id);
  return inserted.id;
};
