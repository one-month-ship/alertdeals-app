import { and, DrizzleConfig, eq, ExtractTablesWithRelations, or } from 'drizzle-orm';
import { drizzle, PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import { PgTransaction } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from '../schema/index.js';
import { createDrizzle } from './rls/client-wrapper.js';
import { decode } from './rls/jwt.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const globalForPostgres = globalThis as unknown as {
  postgresClient: postgres.Sql | undefined;
};

const postgresClient =
  globalForPostgres.postgresClient ?? postgres(databaseUrl, { prepare: false });

if (process.env.NODE_ENV !== 'production') {
  globalForPostgres.postgresClient = postgresClient;
}

const config = {
  casing: 'snake_case',
  schema,
  logger: false,
} satisfies DrizzleConfig<typeof schema>;

const defaultDBClient = drizzle({ client: postgresClient, ...config });

// RLS-aware client: pass an access token, queries run as that user
function getDBWithTokenClient(accessToken: string) {
  return createDrizzle(decode(accessToken), {
    admin: defaultDBClient,
    client: defaultDBClient,
  });
}

// Admin client: bypasses RLS — use for system tasks (cron, worker, migrations)
function getDBAdminClient() {
  return defaultDBClient;
}

export { getDBAdminClient, getDBWithTokenClient, postgresClient };

// Re-export common drizzle operators
export { and, eq, or };
export {
  asc,
  desc,
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
  sql,
} from 'drizzle-orm';

export type { BinaryOperator, SQL } from 'drizzle-orm';
export type { PgColumn } from 'drizzle-orm/pg-core';

type TDBModel = keyof typeof defaultDBClient.query;
type TDBAdminClient = Awaited<ReturnType<typeof getDBAdminClient>>;
type TDBWithTokenClient = Awaited<ReturnType<typeof getDBWithTokenClient>>;
type TDBClient = TDBAdminClient | TDBWithTokenClient;
type TDBQuery =
  | PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
  | typeof defaultDBClient;
type TEqOperator = typeof eq;
type TANDOperator = typeof and;
type TDBOptions = { dbClient?: TDBWithTokenClient; bypassRLS?: boolean };

export type {
  TANDOperator,
  TDBAdminClient,
  TDBClient,
  TDBModel,
  TDBOptions,
  TDBQuery,
  TDBWithTokenClient,
  TEqOperator,
};
