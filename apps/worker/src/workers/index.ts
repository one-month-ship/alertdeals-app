/**
 * Worker Orchestration — starts every BullMQ worker the API hosts.
 *
 * BullMQ retry behavior:
 *   - throw `UnrecoverableError` → marked failed, no retry (use for invalid input).
 *   - throw any other error      → retried up to RETRY_CONFIG.<queue>.attempts times.
 */

import { Worker } from 'bullmq';
import { RETRY_CONFIG } from '../config/index.js';
import { QUEUE_NAMES } from '../queues/index.js';
import { connection } from '../redis.js';
import { dailyOrchestratorWorker } from './daily-orchestrator.js';
import { scrapingWorker } from './scraping.js';

export async function startAllWorkers(): Promise<Worker[]> {
  return [
    new Worker(QUEUE_NAMES.SCRAPING, scrapingWorker, {
      connection,
      ...RETRY_CONFIG.SCRAPING,
      // 5 min — scraping fetches the Lobstr API then batch-upserts ads.
      lockDuration: 300000,
      // Shock absorber, not a fix: with the default concurrency of 1, a single
      // wedged job froze the whole queue for 6 days (2026-10-16). Kept low —
      // every job batch-upserts against the same pooled DB.
      concurrency: 3,
    }),
    new Worker(QUEUE_NAMES.DAILY_ORCHESTRATOR, dailyOrchestratorWorker, {
      connection,
    }),
  ];
}
