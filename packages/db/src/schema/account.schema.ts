import { InferSelectModel, sql } from 'drizzle-orm';
import { boolean, pgPolicy, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';

export const accounts = pgTable(
  'accounts',
  {
    id: uuid().primaryKey(),
    email: varchar({ length: 320 }).notNull(),
    hasSubscription: boolean('has_subscription').default(false).notNull(),
    confirmedByAdmin: boolean('confirmed_by_admin').default(false).notNull(),
    isFirstConnexion: boolean('is_first_connexion').default(true).notNull(),
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
