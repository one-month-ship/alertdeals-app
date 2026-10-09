import {
  ALERT_MODE_VALUES,
  ALERT_STATUS_VALUES,
  DEFAULT_ALERT_SOURCES,
  EAlertStatus,
  TAlertNotificationChannels,
} from '@alertdeals/shared';
import { InferInsertModel, InferSelectModel, relations, sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  real,
  smallint,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { accounts } from './account.schema';
import { adOwnerType, adSource, brands, locations, vehicleModels } from './ad.schema';

export const alertStatus = pgEnum('alert_status', ALERT_STATUS_VALUES);
export const alertMode = pgEnum('alert_mode', ALERT_MODE_VALUES);

export const alerts = pgTable(
  'alerts',
  {
    id: uuid().defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    name: varchar({ length: 255 }),
    status: alertStatus().notNull().default(EAlertStatus.ACTIVE),
    // Listing platforms this alert matches ads from
    sources: adSource().array().notNull().default(DEFAULT_ALERT_SOURCES),
    locationId: integer('location_id').references(() => locations.id),
    radiusInKm: smallint('radius_in_km'),
    modelYearMin: smallint('model_year_min'),
    modelYearMax: smallint('model_year_max'),
    mileageMin: integer('mileage_min'),
    mileageMax: integer('mileage_max'),
    priceMin: real('price_min'),
    mode: alertMode().notNull(),
    priceMax: real('price_max'),
    marginMinPercentage: real('margin_min_percentage'),
    // Skip wrecks: a very low price on a damaged car is not a deal
    excludeDamaged: boolean('exclude_damaged').notNull().default(true),
    // Seller type the alert targets (private / pro); null = both
    ownerType: adOwnerType('owner_type'),
    notificationChannels: jsonb('notification_channels')
      .$type<TAlertNotificationChannels>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'alert_account_id_fk',
    }).onDelete('cascade'),
    index('alert_account_id_idx').on(table.accountId),
    index('alert_account_id_status_idx').on(table.accountId, table.status),
    pgPolicy('enable insert for authenticated roles', {
      as: 'permissive',
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`true`,
    }),
    pgPolicy('enable read update and delete for the alert owners', {
      as: 'permissive',
      for: 'all',
      to: authenticatedRole,
      using: sql`${table.accountId} = ${authUid}`,
      withCheck: sql`${table.accountId} = ${authUid}`,
    }),
  ],
);

export const alertBrands = pgTable(
  'alert_brands',
  {
    id: uuid().defaultRandom().primaryKey(),
    alertId: uuid('alert_id').notNull(),
    brandId: smallint('brand_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.alertId],
      foreignColumns: [alerts.id],
      name: 'alert_brand_alert_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: 'alert_brand_brand_id_fk',
    }).onDelete('no action'),
    unique('alert_brand_alert_id_brand_id_key').on(table.alertId, table.brandId),
    index('alert_brand_alert_id_idx').on(table.alertId),
    pgPolicy('enable all crud for the alert owners', {
      as: 'permissive',
      for: 'all',
      to: authenticatedRole,
      using: sql`exists (
        select 1 from alerts a
        where a.id = ${table.alertId}
        and a.account_id = ${authUid}
      )`,
      withCheck: sql`exists (
        select 1 from alerts a
        where a.id = ${table.alertId}
        and a.account_id = ${authUid}
      )`,
    }),
  ],
);

export const alertModels = pgTable(
  'alert_models',
  {
    id: uuid().defaultRandom().primaryKey(),
    alertId: uuid('alert_id').notNull(),
    modelId: smallint('model_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.alertId],
      foreignColumns: [alerts.id],
      name: 'alert_model_alert_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.modelId],
      foreignColumns: [vehicleModels.id],
      name: 'alert_model_model_id_fk',
    }).onDelete('no action'),
    unique('alert_model_alert_id_model_id_key').on(table.alertId, table.modelId),
    index('alert_model_alert_id_idx').on(table.alertId),
    pgPolicy('enable all crud for the alert owners', {
      as: 'permissive',
      for: 'all',
      to: authenticatedRole,
      using: sql`exists (
        select 1 from alerts a
        where a.id = ${table.alertId}
        and a.account_id = ${authUid}
      )`,
      withCheck: sql`exists (
        select 1 from alerts a
        where a.id = ${table.alertId}
        and a.account_id = ${authUid}
      )`,
    }),
  ],
);

export const alertsRelations = relations(alerts, ({ one, many }) => ({
  account: one(accounts, { fields: [alerts.accountId], references: [accounts.id] }),
  location: one(locations, { fields: [alerts.locationId], references: [locations.id] }),
  brands: many(alertBrands),
  models: many(alertModels),
}));

export const alertBrandsRelations = relations(alertBrands, ({ one }) => ({
  alert: one(alerts, { fields: [alertBrands.alertId], references: [alerts.id] }),
  brand: one(brands, { fields: [alertBrands.brandId], references: [brands.id] }),
}));

export const alertModelsRelations = relations(alertModels, ({ one }) => ({
  alert: one(alerts, { fields: [alertModels.alertId], references: [alerts.id] }),
  vehicleModel: one(vehicleModels, {
    fields: [alertModels.modelId],
    references: [vehicleModels.id],
  }),
}));

export type TAlert = InferSelectModel<typeof alerts>;
export type TAlertInsert = Omit<InferInsertModel<typeof alerts>, 'createdAt'>;
export type TAlertBrand = InferSelectModel<typeof alertBrands>;
export type TAlertModel = InferSelectModel<typeof alertModels>;
