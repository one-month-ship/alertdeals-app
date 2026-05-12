import {
  ALERT_MODE_VALUES,
  ALERT_STATUS_VALUES,
  EAlertStatus,
  TAlertNotificationChannels,
} from '@alertdeals/shared';
import { InferInsertModel, InferSelectModel, relations, sql } from 'drizzle-orm';
import {
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
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { accounts } from './account.schema';
import { brands, locations, vehicleModels } from './ad.schema';

export const alertStatus = pgEnum('alert_status', ALERT_STATUS_VALUES);
export const alertMode = pgEnum('alert_mode', ALERT_MODE_VALUES);

export const alerts = pgTable(
  'alerts',
  {
    id: uuid().defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    name: varchar({ length: 255 }),
    status: alertStatus().notNull().default(EAlertStatus.ACTIVE),
    brandId: smallint('brand_id').references(() => brands.id),
    modelId: smallint('model_id').references(() => vehicleModels.id),
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

export const alertsRelations = relations(alerts, ({ one }) => ({
  account: one(accounts, { fields: [alerts.accountId], references: [accounts.id] }),
  brand: one(brands, { fields: [alerts.brandId], references: [brands.id] }),
  vehicleModel: one(vehicleModels, { fields: [alerts.modelId], references: [vehicleModels.id] }),
  location: one(locations, { fields: [alerts.locationId], references: [locations.id] }),
}));

export type TAlert = InferSelectModel<typeof alerts>;
export type TAlertInsert = Omit<InferInsertModel<typeof alerts>, 'createdAt'>;
