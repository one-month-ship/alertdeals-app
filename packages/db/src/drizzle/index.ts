import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { createDrizzle } from './rls/client-wrapper';
import { decode } from './rls/jwt';

const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) {
  throw new Error('SUPABASE_DATABASE_URL environment variable is not set');
}

// Singleton across dev HMR reloads to avoid creating multiple connection pools.
const globalForPostgres = globalThis as unknown as {
  postgresClient: postgres.Sql | undefined;
};

const postgresClient =
  globalForPostgres.postgresClient ?? postgres(databaseUrl, { prepare: false });

if (process.env.NODE_ENV !== 'production') {
  globalForPostgres.postgresClient = postgresClient;
}

const defaultDBClient = drizzle({
  client: postgresClient,
  casing: 'snake_case',
  schema,
  logger: false,
});

/**
 * Admin DB client — bypasses RLS. Use only for workers/cron/webhooks (no user JWT).
 * In user-facing server actions, prefer getDBWithTokenClient via createDrizzleSupabaseClient.
 */
export function getDBAdminClient() {
  return defaultDBClient;
}

export function getDBWithTokenClient(accessToken: string) {
  return createDrizzle(decode(accessToken), {
    admin: defaultDBClient,
    client: defaultDBClient,
  });
}

export type TDBAdminClient = ReturnType<typeof getDBAdminClient>;
export type TDBWithTokenClient = ReturnType<typeof getDBWithTokenClient>;

export {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql
} from 'drizzle-orm';

export type { SQL } from 'drizzle-orm';
export type { PgColumn } from 'drizzle-orm/pg-core';

