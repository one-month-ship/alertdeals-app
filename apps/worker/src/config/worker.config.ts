/**
 * Worker Configuration
 * Single source of truth for ingestion-related constants.
 */

import { EAdSource, TAdSource } from '@alertdeals/shared';

/**
 * Error Classification for Retry Logic
 *
 * RETRYABLE: network/server errors that often resolve themselves.
 * NON_RETRYABLE: client/auth/validation errors — retrying won't help.
 */
export const RETRYABLE_HTTP_CODES = [408, 429, 500, 502, 503, 504] as const;
export const NON_RETRYABLE_HTTP_CODES = [400, 401, 403, 404, 422] as const;

export function isRetryableHttpCode(code: number): boolean {
  return RETRYABLE_HTTP_CODES.includes(code as (typeof RETRYABLE_HTTP_CODES)[number]);
}

/**
 * BullMQ retry config for the scraping queue.
 * 2 attempts with a fixed 5s delay — Lobstr API blips are usually transient.
 */
export const RETRY_CONFIG = {
  SCRAPING: {
    attempts: 2,
    backoff: {
      type: 'fixed' as const,
      delay: 5000,
    },
  },
} as const;

/**
 * Hard wall-clock ceiling for a single scraping job, in milliseconds.
 *
 * This is the PRIMARY protection against a wedged job, not a secondary belt:
 * a query whose socket died cannot be bounded from the DB client at all (see
 * the note in packages/db/src/drizzle/index.ts — Supavisor ignores
 * `statement_timeout`, and postgres.js has no per-query timeout). Whatever the
 * reason an `await` never settles (dead socket, unbounded network call, mapper
 * bug), the job must eventually reject so BullMQ can retry it and free the
 * queue. Without it a job stays `active` forever and — concurrency being
 * small — stalls every job behind it (2026-10-16: 6 days of silence, 23 jobs
 * queued, zero ads ingested).
 *
 * 10 min: comfortably above a legitimate run (Lobstr fetch + batch upsert of
 * ~1000 ads takes well under a minute) while still bounded. Above Supabase's
 * own 2min statement ceiling, so a server-side cancel — clearer error, socket
 * intact — wins whenever the connection is still alive.
 */
export const SCRAPING_JOB_TIMEOUT_MS = 600_000;

/**
 * Same ceiling for the daily orchestrator, which is just as exposed: it runs
 * many DB round-trips (one matching pass per account, then inserts), so any of
 * them could hang on a dropped socket. 15 min — it legitimately takes longer
 * than a scraping run since it walks every active alert.
 */
export const DAILY_ORCHESTRATOR_JOB_TIMEOUT_MS = 900_000;

/**
 * Lobstr squids: one squid (scraper) per listing platform.
 * The webhook gives us `squid.id`, which tells us where the ads come from.
 */
export const LOBSTR_SQUIDS: Record<TAdSource, () => string | undefined> = {
  [EAdSource.LEBONCOIN]: () => process.env.LOBSTR_SQUID_LEBONCOIN,
  [EAdSource.AUTOSCOUT24]: () => process.env.LOBSTR_SQUID_AUTOSCOUT24,
  [EAdSource.LACENTRALE]: () => process.env.LOBSTR_SQUID_LACENTRALE,
  [EAdSource.PARUVENDU]: () => process.env.LOBSTR_SQUID_PARUVENDU,
};

export const getSourceFromSquidId = (
  squidId: string | undefined,
): TAdSource | null => {
  if (!squidId) return null;
  const match = (
    Object.entries(LOBSTR_SQUIDS) as [TAdSource, () => string | undefined][]
  ).find(([, getSquidId]) => getSquidId() === squidId);
  return match ? match[0] : null;
};
