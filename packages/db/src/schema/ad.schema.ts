import { InferInsertModel, InferSelectModel, relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgPolicy,
  pgTable,
  real,
  serial,
  smallint,
  smallserial,
  text,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { authenticatedRole } from 'drizzle-orm/supabase';

export const ads = pgTable(
  'ads',
  {
    id: uuid().defaultRandom().primaryKey(),
    typeId: smallint('type_id')
      .references(() => adTypes.id)
      .notNull(),
    subtypeId: smallint('subtype_id').references(() => adSubTypes.id),
    drivingLicenceId: smallint('driving_licence_id').references(() => drivingLicences.id),
    gearBoxId: smallint('gear_box_id').references(() => gearBoxes.id),
    vehicleSeatsId: smallint('vehicle_seats_id').references(() => vehicleSeats.id),
    vehicleStateId: smallint('vehicle_state_id').references(() => vehicleStates.id),
    locationId: integer('location_id')
      .references(() => locations.id)
      .notNull(),
    brandId: integer('brand_id').references(() => brands.id),
    modelId: smallint('model_id').references(() => vehicleModels.id),
    marketPositionId: smallint('market_position_id').references(() => marketPositions.id),
    fuelId: smallint('fuel_id').references(() => fuels.id),
    url: text().notNull(),
    originalAdId: text('original_ad_id').notNull().unique(),
    title: text().notNull(),
    description: text(),
    picture: text(),
    pictures: text().array(),
    price: doublePrecision().notNull(),
    hasBeenReposted: boolean('has_been_reposted').default(false).notNull(),
    hasBeenBoosted: boolean('has_been_boosted').default(false).notNull(),
    isUrgent: boolean('is_urgent').default(false).notNull(),
    modelYear: smallint('model_year'),
    model: text(),
    initialPublicationDate: date('initial_publication_date').notNull(),
    lastPublicationDate: date('last_publication_date').notNull(),
    mileage: real(),
    createdAt: date('created_at').defaultNow(),
    priceHasDropped: boolean('price_has_dropped').default(false).notNull(),
    priceMin: real('price_min'),
    priceMax: real('price_max'),
    // Margins (computed in the ingestion worker before upsert):
    //   margin_amount_*     = price_min/max - price
    //   margin_percentage_* = margin_amount_* / price
    marginAmountMin: real('margin_amount_min'),
    marginAmountMax: real('margin_amount_max'),
    marginPercentageMin: real('margin_percentage_min'),
    marginPercentageMax: real('margin_percentage_max'),
    isLowPrice: boolean('is_low_price').default(false).notNull(),
    phoneNumber: text('phone_number'),
    isWhatsappPhone: boolean('is_whatsapp_phone').default(false),
    ownerName: text('owner_name').notNull(),
    entryYear: smallint('entry_year'),
    hasPhone: boolean('has_phone').default(false).notNull(),
    equipments: text(),
    otherSpecifications: text('other_specifications'),
    technicalInspectionYear: smallint('technical_inspection_year'),
    acceptSalesmen: boolean('accept_salesmen').default(true).notNull(),
    isMobilePhone: boolean('is_mobile_phone').default(false).notNull(),
    goodDealName: text('good_deal_name'),
  },
  (table) => [
    index('ads_created_at_location_state_flags_idx').on(
      table.createdAt,
      table.typeId,
      table.locationId,
      table.acceptSalesmen,
      table.hasPhone,
      table.ownerName,
      table.subtypeId,
      table.vehicleStateId,
      table.modelYear,
      table.mileage,
      table.isLowPrice,
      table.isUrgent,
      table.hasBeenReposted,
      table.hasBeenBoosted,
      table.priceHasDropped,
      table.price,
      table.drivingLicenceId,
      table.gearBoxId,
      table.vehicleSeatsId,
      table.brandId,
      table.fuelId,
    ),
    index('ads_title_search_idx').on(table.title),
    index('ads_model_id_idx').on(table.modelId),
    pgPolicy('Enable read access for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);

export type TAdInsert = Omit<InferInsertModel<typeof ads>, 'createdAt'>;

export const adTypes = pgTable(
  'ad_types',
  {
    id: smallserial().primaryKey(),
    name: text().notNull().unique('ad_type_name_unique'),
    lbcValue: text('lbc_value'),
    lobstrValue: text('lobstr_value'),
  },
  () => [
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TAdType = InferSelectModel<typeof adTypes>;

export const adSubTypes = pgTable(
  'ad_sub_types',
  {
    id: smallserial().primaryKey(),
    adTypeId: smallint('ad_type_id')
      .references(() => adTypes.id)
      .notNull(),
    name: text().notNull(),
    lbcValue: text('lbc_value'),
    lobstrValue: text('lobstr_value'),
  },
  (table) => [
    unique('unique_subtype').on(table.adTypeId, table.name),
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TAdSubType = InferSelectModel<typeof adSubTypes>;

export const drivingLicences = pgTable(
  'driving_licences',
  {
    id: smallserial().primaryKey(),
    name: text().notNull().unique('driving_licence_name_unique'),
    lbcValue: text('lbc_value'),
    lobstrValue: text('lobstr_value'),
  },
  () => [
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TDrivingLicence = InferSelectModel<typeof drivingLicences>;

export const gearBoxes = pgTable(
  'gear_boxes',
  {
    id: smallserial().primaryKey(),
    name: text().notNull().unique('gear_box_name_unique'),
    lbcValue: text('lbc_value'),
    lobstrValue: text('lobstr_value'),
  },
  () => [
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TGearBoxe = InferSelectModel<typeof gearBoxes>;

export const vehicleSeats = pgTable(
  'vehicle_seats',
  {
    id: smallserial().primaryKey(),
    name: text().notNull().unique('vehicle_seats_name_unique'),
    lbcValue: text('lbc_value'),
    lobstrValue: text('lobstr_value'),
  },
  () => [
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TVehicleSeats = InferSelectModel<typeof vehicleSeats>;

export const vehicleStates = pgTable(
  'vehicle_states',
  {
    id: smallserial().primaryKey(),
    name: text().notNull().unique('vehicle_state_name_unique'),
    lbcValue: text('lbc_value'),
    lobstrValue: text('lobstr_value'),
  },
  () => [
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TVehicleState = InferSelectModel<typeof vehicleStates>;

export const locations = pgTable(
  'locations',
  {
    id: serial().primaryKey(),
    zipcode: varchar({ length: 5 }).notNull(),
    name: text().notNull(),
    lat: real().notNull(),
    lng: real().notNull(),
  },
  (table) => [
    unique('zipcode_name_unique').on(table.name, table.zipcode),
    index('locations_geo_idx').using(
      'gist',
      sql`(ST_MakePoint(${table.lng}, ${table.lat})::geography)`,
    ),
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TLocation = InferSelectModel<typeof locations>;

export const brands = pgTable(
  'brands',
  {
    id: smallserial().primaryKey(),
    name: text().notNull().unique('brand_name_unique'),
    lbcValue: text('lbc_value'),
    lobstrValue: text('lobstr_value'),
  },
  () => [
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TBrand = InferSelectModel<typeof brands>;

export const vehicleModels = pgTable(
  'vehicle_models',
  {
    id: smallserial().primaryKey(),
    brandId: smallint('brand_id')
      .references(() => brands.id)
      .notNull(),
    name: text().notNull(),
    lbcValue: text('lbc_value'),
    lobstrValue: text('lobstr_value'),
  },
  (table) => [
    unique('vehicle_model_brand_name_unique').on(table.brandId, table.name),
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TVehicleModel = InferSelectModel<typeof vehicleModels>;

export const marketPositions = pgTable(
  'market_positions',
  {
    id: smallserial().primaryKey(),
    name: text().notNull(),
    lbcValue: text('lbc_value'),
    lobstrValue: text('lobstr_value'),
  },
  () => [
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TMarketPosition = InferSelectModel<typeof marketPositions>;

export const fuels = pgTable(
  'fuels',
  {
    id: smallserial().primaryKey(),
    name: text().notNull().unique('fuel_name_unique'),
    lbcValue: text('lbc_value'),
    lobstrValue: text('lobstr_value'),
  },
  () => [
    pgPolicy('enable read for authenticated users', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);
export type TFuel = InferSelectModel<typeof fuels>;

export const adsRelations = relations(ads, ({ one }) => ({
  type: one(adTypes, { fields: [ads.typeId], references: [adTypes.id] }),
  subtype: one(adSubTypes, { fields: [ads.subtypeId], references: [adSubTypes.id] }),
  drivingLicence: one(drivingLicences, {
    fields: [ads.drivingLicenceId],
    references: [drivingLicences.id],
  }),
  gearBox: one(gearBoxes, { fields: [ads.gearBoxId], references: [gearBoxes.id] }),
  vehicleSeats: one(vehicleSeats, {
    fields: [ads.vehicleSeatsId],
    references: [vehicleSeats.id],
  }),
  vehicleState: one(vehicleStates, {
    fields: [ads.vehicleStateId],
    references: [vehicleStates.id],
  }),
  location: one(locations, { fields: [ads.locationId], references: [locations.id] }),
  brand: one(brands, { fields: [ads.brandId], references: [brands.id] }),
  vehicleModel: one(vehicleModels, {
    fields: [ads.modelId],
    references: [vehicleModels.id],
  }),
  marketPosition: one(marketPositions, {
    fields: [ads.marketPositionId],
    references: [marketPositions.id],
  }),
  fuel: one(fuels, { fields: [ads.fuelId], references: [fuels.id] }),
}));

export type TAd = InferSelectModel<typeof ads> & {
  type?: TAdType;
  location?: TLocation;
  subtype?: TAdSubType | null;
  drivingLicence?: TDrivingLicence | null;
  gearBox?: TGearBoxe | null;
  vehicleSeats?: TVehicleSeats | null;
  vehicleState?: TVehicleState | null;
  brand?: TBrand | null;
  vehicleModel?: TVehicleModel | null;
  marketPosition?: TMarketPosition | null;
  fuel?: TFuel | null;
};

export type TAdReferenceData = {
  adTypes: Map<string, number>;
  adSubTypes: Map<string, number>;
  brands: Map<string, number>;
  vehicleModels: Map<string, number>;
  marketPositions: Map<string, number>;
  zipcodes: Map<string, number>;
  gearBoxes: Map<string, number>;
  drivingLicences: Map<string, number>;
  fuels: Map<string, number>;
  vehicleSeats: Map<string, number>;
  vehicleStates: Map<string, number>;
};
