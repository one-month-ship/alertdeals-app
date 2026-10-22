/**
 * Scraping Worker — processes Lobstr webhook jobs and persists ads.
 */

import { TAdSource } from '@alertdeals/shared';
import { Job, UnrecoverableError } from 'bullmq';
import { SCRAPING_JOB_TIMEOUT_MS } from '../config/index.js';
import { handleLobstrWebhook } from '../services/lobstr.service.js';
import { withTimeout } from '../utils/general.utils.js';

interface ScrapingJob {
  runId: string;
  source: TAdSource; // Listing platform, resolved from the webhook's squid id
}

export async function scrapingWorker(job: Job<ScrapingJob>) {
  const { runId, source } = job.data;

  if (!runId) {
    // No retry — a job without runId is permanently invalid.
    throw new UnrecoverableError('Lobstr run ID is required');
  }

  if (!source) {
    throw new UnrecoverableError('Ad source is required');
  }

  await withTimeout(
    handleLobstrWebhook(runId, source),
    SCRAPING_JOB_TIMEOUT_MS,
    `[scraping] run ${runId} (${source})`,
  );

  return {
    success: true,
    runId,
    source,
    timestamp: new Date().toISOString(),
  };
}
