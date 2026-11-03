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
import { WithTimeoutError } from '../utils/general.utils.js';
import { dailyOrchestratorWorker } from './daily-orchestrator.js';
import { scrapingWorker } from './scraping.js';

/**
 * Deux timeouts de job consécutifs = pool DB très probablement vérolé
 * (connexions dont les réponses se perdent entre Supavisor et nous, incident
 * 2026-11-03 : chaque job pendait ses 600s, aucune requête n'aboutissait).
 * Aucun correctif client ne répare ces sockets (cf. packages/db/src/drizzle) :
 * on redémarre volontairement pour repartir sur un pool neuf.
 */
const CONSECUTIVE_TIMEOUTS_BEFORE_EXIT = 2;

export async function startAllWorkers(): Promise<Worker[]> {
  const scraping = new Worker(QUEUE_NAMES.SCRAPING, scrapingWorker, {
    connection,
    ...RETRY_CONFIG.SCRAPING,
    // 5 min — scraping fetches the Lobstr API then batch-upserts ads.
    lockDuration: 300000,
    // Shock absorber, not a fix: with the default concurrency of 1, a single
    // wedged job froze the whole queue for 6 days (2026-10-16). La concurrence
    // 3 qui en a résulté a montré son revers le 2026-11-03 : 3 jobs × 11 SELECT
    // de référentiels en parallèle saturaient le pool DB (max 10) et les
    // page-1 simultanées sur l'API Lobstr se throttlaient entre elles (429).
    // Retour à 1 : le job gelé est désormais couvert par withTimeout + le
    // circuit breaker ci-dessous, et les runs (toutes les 5-10 min, < 1 min de
    // traitement) n'ont pas besoin de parallélisme.
    concurrency: 1,
  });

  // Visibilité : un rejet de withTimeout n'est loggé nulle part ailleurs (le
  // catch de lobstr.service ne voit pas ce qui se passe au-dessus de lui) —
  // le 2026-11-03, 3 jobs ont pendu 600s et sont morts en silence.
  let consecutiveTimeouts = 0;
  scraping.on('completed', () => {
    consecutiveTimeouts = 0;
  });
  scraping.on('failed', (job, error) => {
    console.error(`[scraping] job ${job?.id ?? '?'} failed: ${error.message}`);

    if (!(error instanceof WithTimeoutError)) {
      // Échec « normal » (429 Lobstr, payload invalide…) : le pipeline vit.
      consecutiveTimeouts = 0;
      return;
    }

    consecutiveTimeouts += 1;
    if (consecutiveTimeouts >= CONSECUTIVE_TIMEOUTS_BEFORE_EXIT) {
      console.error(
        `[scraping] ${consecutiveTimeouts} jobs expirés d'affilée — pool DB ` +
          'suspect, exit(1) volontaire pour que Railway relance le worker ' +
          'avec des connexions neuves (restartPolicy ON_FAILURE)',
      );
      process.exit(1);
    }
  });

  const orchestrator = new Worker(
    QUEUE_NAMES.DAILY_ORCHESTRATOR,
    dailyOrchestratorWorker,
    {
      connection,
    },
  );
  orchestrator.on('failed', (job, error) => {
    console.error(
      `[daily-orchestrator] job ${job?.id ?? '?'} failed: ${error.message}`,
    );
  });

  return [scraping, orchestrator];
}
