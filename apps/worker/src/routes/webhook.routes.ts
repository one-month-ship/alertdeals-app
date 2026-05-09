/**
 * Webhook Routes — incoming notifications from external scraping services.
 */

import { Request, Response, Router } from 'express';
import { scrapingQueue } from '../queues/index.js';

const router: Router = Router();

/**
 * POST /api/webhooks/lobstr
 * Lobstr posts here when a scraping run completes. We acknowledge fast and
 * dispatch the heavy work (fetch + parse + upsert) to the scraping queue.
 */
router.post('/lobstr', async (req: Request, res: Response) => {
  try {
    const { id: runId } = req.body;

    if (!runId) {
      return res.status(400).json({ error: 'runId is required' });
    }

    const job = await scrapingQueue.add(
      `lobstr-run-${runId}`,
      { runId },
      // Stable jobId prevents duplicate processing if Lobstr retries the webhook.
      { jobId: `lobstr-${runId}` },
    );

    res.json({ success: true, jobId: job.id, runId });
  } catch (error) {
    console.error('[webhook/lobstr] error', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
