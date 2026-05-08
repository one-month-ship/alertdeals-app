import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index.js';

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
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
 * Admin DB client — bypasses RLS. Use only on the server side (workers, server routes).
 * Never expose this to client-side code.
 */
export function getDBAdminClient() {
  return defaultDBClient;
}

export type TDBAdminClient = ReturnType<typeof getDBAdminClient>;

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
  sql,
} from 'drizzle-orm';

export type { SQL } from 'drizzle-orm';
export type { PgColumn } from 'drizzle-orm/pg-core';
