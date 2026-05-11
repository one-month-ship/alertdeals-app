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
import { scrapingWorker } from './scraping.js';

export async function startAllWorkers(): Promise<Worker[]> {
  return [
    new Worker(QUEUE_NAMES.SCRAPING, scrapingWorker, {
      connection,
      ...RETRY_CONFIG.SCRAPING,
    }),
  ];
}
