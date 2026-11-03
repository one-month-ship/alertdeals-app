import {
  adSubTypes,
  adTypes,
  brands,
  drivingLicences,
  fuels,
  gearBoxes,
  locations,
  marketPositions,
  TAdReferenceData,
  TDBAdminClient,
  vehicleModels,
  vehicleSeats,
  vehicleStates,
} from '@alertdeals/db';

/**
 * Which platform-specific value field to use when building lookup maps.
 * Currently only Lobstr; future scrapers can extend this union.
 */
export type TPlatformValue = 'lobstrValue';

/**
 * Builds the lookup key for vehicle models.
 * Model names are not unique across brands (e.g. Peugeot 208 vs Ferrari 208),
 * so the lookup must be scoped by brand.
 */
export const getVehicleModelLookupKey = (
  brandId: number,
  platformValue: string,
): string => `${brandId}:${platformValue}`;

/**
 * Loads every lookup table once and returns Map<platformValue, id> for O(1) lookup
 * during ad ingestion. Called once per webhook batch.
 */
export const fetchAllReferenceData = async (
  dbClient: TDBAdminClient,
  platformField: TPlatformValue,
): Promise<TAdReferenceData> => {
  // ⚠️ Séquentiel, surtout pas Promise.all : au-delà de `max` requêtes
  // simultanées (10 par défaut), postgres.js met l'excédent en file côté
  // client et, derrière le pooler Supavisor (port 6543, mode transaction),
  // ces requêtes différées perdent leurs réponses et pendent pour toujours.
  // Incident 2026-11-03, reproduit hors Railway : 11 selects × 3 jobs
  // concurrents → seul le premier lot répond, les 22 autres gèlent ; en
  // séquentiel les 33 passent en 1,5s. Le coût (~1s par job) est négligeable
  // à la cadence des runs Lobstr.
  const adTypesData = await dbClient.select().from(adTypes);
  const adSubTypesData = await dbClient.select().from(adSubTypes);
  const brandsData = await dbClient.select().from(brands);
  const vehicleModelsData = await dbClient.select().from(vehicleModels);
  const marketPositionsData = await dbClient.select().from(marketPositions);
  const zipcodesData = await dbClient.select().from(locations);
  const gearBoxesData = await dbClient.select().from(gearBoxes);
  const drivingLicencesData = await dbClient.select().from(drivingLicences);
  const fuelsData = await dbClient.select().from(fuels);
  const vehicleSeatsData = await dbClient.select().from(vehicleSeats);
  const vehicleStatesData = await dbClient.select().from(vehicleStates);

  return {
    adTypes: new Map(adTypesData.map((item) => [item[platformField] || '', item.id])),
    adSubTypes: new Map(adSubTypesData.map((item) => [item[platformField] || '', item.id])),
    brands: new Map(brandsData.map((item) => [item[platformField] || '', item.id])),
    brandsByNormalizedName: new Map(
      brandsData.map((item) => [item.normalizedName, item.id]),
    ),
    brandNamesById: new Map(brandsData.map((item) => [item.id, item.name])),
    vehicleModels: new Map(
      vehicleModelsData.map((item) => [
        getVehicleModelLookupKey(item.brandId, item[platformField] || ''),
        item.id,
      ]),
    ),
    vehicleModelsByNormalizedName: new Map(
      vehicleModelsData.map((item) => [
        getVehicleModelLookupKey(item.brandId, item.normalizedName),
        item.id,
      ]),
    ),
    marketPositions: new Map(
      marketPositionsData.map((item) => [item[platformField] || '', item.id]),
    ),
    zipcodes: new Map(zipcodesData.map((item) => [item.zipcode, item.id])),
    gearBoxes: new Map(gearBoxesData.map((item) => [item[platformField] || '', item.id])),
    drivingLicences: new Map(
      drivingLicencesData.map((item) => [item[platformField] || '', item.id]),
    ),
    fuels: new Map(fuelsData.map((item) => [item[platformField] || '', item.id])),
    vehicleSeats: new Map(
      vehicleSeatsData.map((item) => [item[platformField] || '', item.id]),
    ),
    vehicleStates: new Map(
      vehicleStatesData.map((item) => [item[platformField] || '', item.id]),
    ),
  };
};
