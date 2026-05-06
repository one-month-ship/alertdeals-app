import { Worker } from 'bullmq';
import express, { Request, Response } from 'express';
import { Server } from 'http';
import { queues } from './queues/index.js';
import { connection } from './redis.js';
import routes from './routes/index.js';
import { startAllWorkers } from './workers/index.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

let server: Server;
let workers: Worker[] = [];

app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TODO: add auth middleware (Bearer token) before deploying — webhooks are public.
app.use('/api', routes);

(async () => {
  try {
    // Bull Board UI — dev only. Inspect queues at /ui.
    if (process.env.NODE_ENV !== 'production') {
      const { createBullBoard } = await import('@bull-board/api');
      const { BullMQAdapter } = await import('@bull-board/api/bullMQAdapter');
      const { ExpressAdapter } = await import('@bull-board/express');

      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath('/ui');

      createBullBoard({
        queues: Object.values(queues).map((q) => new BullMQAdapter(q)),
        serverAdapter,
      });

      app.use('/ui', serverAdapter.getRouter());
      console.log(`[api] Bull Board available at http://localhost:${PORT}/ui`);
    }

    workers = await startAllWorkers();
    console.log(`[api] ${workers.length} worker(s) started`);

    server = app.listen(PORT, () => {
      console.log(`[api] listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[api] failed to start', error);
    process.exit(1);
  }
})();

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[api] ${signal} received, shutting down…`);

  if (server) {
    server.close(() => console.log('[api] http server closed'));
  }

  await Promise.all(
    workers.map(async (worker) => {
      try {
        await worker.close();
        console.log(`[api] worker ${worker.name} closed`);
      } catch (error) {
        console.error(`[api] error closing worker ${worker.name}`, error);
      }
    }),
  );

  try {
    await connection.quit();
    console.log('[api] redis connection closed');
  } catch (error) {
    console.error('[api] error closing redis', error);
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
