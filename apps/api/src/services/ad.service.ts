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
 * Loads every lookup table once and returns Map<platformValue, id> for O(1) lookup
 * during ad ingestion. Called once per webhook batch.
 */
export const fetchAllReferenceData = async (
  dbClient: TDBAdminClient,
  platformField: TPlatformValue,
): Promise<TAdReferenceData> => {
  const [
    adTypesData,
    adSubTypesData,
    brandsData,
    vehicleModelsData,
    marketPositionsData,
    zipcodesData,
    gearBoxesData,
    drivingLicencesData,
    fuelsData,
    vehicleSeatsData,
    vehicleStatesData,
  ] = await Promise.all([
    dbClient.select().from(adTypes),
    dbClient.select().from(adSubTypes),
    dbClient.select().from(brands),
    dbClient.select().from(vehicleModels),
    dbClient.select().from(marketPositions),
    dbClient.select().from(locations),
    dbClient.select().from(gearBoxes),
    dbClient.select().from(drivingLicences),
    dbClient.select().from(fuels),
    dbClient.select().from(vehicleSeats),
    dbClient.select().from(vehicleStates),
  ]);

  return {
    adTypes: new Map(adTypesData.map((item) => [item[platformField] || '', item.id])),
    adSubTypes: new Map(adSubTypesData.map((item) => [item[platformField] || '', item.id])),
    brands: new Map(brandsData.map((item) => [item[platformField] || '', item.id])),
    vehicleModels: new Map(
      vehicleModelsData.map((item) => [item[platformField] || '', item.id]),
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
