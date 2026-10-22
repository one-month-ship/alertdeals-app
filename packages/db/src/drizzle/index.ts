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

// A query that never gets an answer CANNOT be bounded from here. Measured
// against prod (2026-10-22), so nobody burns an afternoon retrying it:
//  - `statement_timeout` is ignored by Supavisor, the Supabase pooler on port
//    6543, in transaction mode — whether passed as a connection parameter, via
//    `onconnect`, or as `options=-c …` in the URL. The server keeps reporting
//    the 2min Supabase sets on the `postgres` role.
//  - That 2min ceiling does fire (a query was cancelled at 120.3s, SQLSTATE
//    57014) but ONLY while the socket still carries the answer back. A socket
//    dropped mid-query — what `idle_timeout` below warns about — leaves the
//    client awaiting a reply that can never arrive.
//  - `max_lifetime` does not help: postgres.js waits for the in-flight query
//    before recycling, so a 60s query survived a `max_lifetime` of 8s.
//  - postgres.js 3.4.9 has no per-query timeout option; `timeout` exists only
//    as an argument to `sql.end()`, and passing it here is silently ignored.
//
// The only thing that actually bounds such a query is an application-level
// timeout around the await (verified: cut at 5002ms). Callers that must not
// hang — BullMQ jobs above all — wrap their work in `withTimeout`; see
// SCRAPING_JOB_TIMEOUT_MS in the worker. Without it a job stays `active`
// forever: 2026-10-16, one scraping job ran 6 days, stalling the queue and
// halting ad ingestion.
const postgresClient =
  globalForPostgres.postgresClient ??
  postgres(databaseUrl, {
    prepare: false,
    // Close idle connections after 20s (postgres.js/Supabase recommendation
    // behind a remote pooler): Supavisor and NAT silently drop idle TCP
    // sockets, and reusing a dead socket makes queries hang forever.
    idle_timeout: 20,
    // Fail fast when the TCP handshake itself cannot complete. Does nothing for
    // a query already in flight — see the note above.
    connect_timeout: 10,
  });

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

