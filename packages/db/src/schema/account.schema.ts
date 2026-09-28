import { ADMIN_ROLE_VALUES, TAccountAttribution } from '@alertdeals/shared';
import { InferSelectModel, sql } from 'drizzle-orm';
import {
  boolean,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';

// Platform-level admin roles (null = regular user, no admin rights)
export const adminRole = pgEnum('admin_role', ADMIN_ROLE_VALUES);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid().primaryKey(),
    email: varchar({ length: 320 }).notNull(),
    confirmedByAdmin: boolean('confirmed_by_admin').default(false).notNull(),
    adminRole: adminRole('admin_role'),
    isFirstConnexion: boolean('is_first_connexion').default(true).notNull(),
    // Trial state — every new account starts trial-eligible; the actual 3-day
    // countdown begins on the first alert creation (trialEndDate is set then).
    // When the cron flips isTrial to false, the user needs an active subscription to continue.
    isTrial: boolean('is_trial').default(true).notNull(),
    trialEndDate: timestamp('trial_end_date', { withTimezone: true }),
    // Attribution marketing (utm_*, fbclid, gclid) de la visite qui a mené au signup
    attribution: jsonb().$type<TAccountAttribution>(),
    whatsappPhoneNumber: varchar('whatsapp_phone_number', { length: 64 }),
    whatsappIsGroup: boolean('whatsapp_is_group').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('enable all for account owners', {
      as: 'permissive',
      for: 'all',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.id}`,
      withCheck: sql`${authUid} = ${table.id}`,
    }),
  ],
);

export type TAccount = InferSelectModel<typeof accounts>;

export type TAccountSelectedKeys<
  T extends Partial<Record<keyof TAccount, boolean>>,
> = {
  [K in keyof T]: T[K] extends true ? K : never;
}[keyof T] &
  keyof TAccount;
