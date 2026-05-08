/**
 * Scraping Worker — processes Lobstr webhook jobs and persists ads.
 */

import { Job, UnrecoverableError } from 'bullmq';
import { handleLobstrWebhook } from '../services/lobstr.service.js';

interface ScrapingJob {
  runId: string;
}

export async function scrapingWorker(job: Job<ScrapingJob>) {
  const { runId } = job.data;

  if (!runId) {
    // No retry — a job without runId is permanently invalid.
    throw new UnrecoverableError('Lobstr run ID is required');
  }

  await handleLobstrWebhook(runId);

  return {
    success: true,
    runId,
    timestamp: new Date().toISOString(),
  };
}
