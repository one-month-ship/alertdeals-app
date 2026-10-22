import { Worker } from "bullmq";
import express, { Request, Response } from "express";
import { Server } from "http";
import { getAllQueuesStats, queues } from "./queues/index.js";
import { connection } from "./redis.js";
import routes from "./routes/index.js";
import {
  closeWhatsAppSocket,
  startWhatsAppListener,
} from "./services/whatsapp.service.js";
import { startAllWorkers } from "./workers/index.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

let server: Server;
let workers: Worker[] = [];

app.use(express.json({ limit: "50mb" }));

// Au-delà, la file n'avance manifestement plus : un monitoring externe peut
// s'en servir pour alerter. Les runs Lobstr arrivent ~3 fois par jour, donc un
// backlog durable à deux chiffres n'est jamais normal.
const QUEUE_BACKLOG_WARN_THRESHOLD = 10;

/**
 * Healthcheck Railway (cf. railway.json) — renvoie TOUJOURS 200 pour ne pas
 * déclencher de redéploiement en boucle, mais expose l'état des queues pour
 * qu'un monitoring externe détecte un backlog. Sans ça, 6 jours d'ingestion
 * morte sont passés inaperçus (16/10/2026) : le process répondait "ok" alors
 * que la queue scraping était bloquée.
 */
app.get("/health", async (_req: Request, res: Response) => {
  const payload: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  try {
    const stats = await getAllQueuesStats();
    payload.queues = stats;
    payload.degraded = stats.some(
      (queue) => queue.waiting > QUEUE_BACKLOG_WARN_THRESHOLD,
    );
  } catch (error) {
    // Redis injoignable : on le signale sans faire échouer le healthcheck.
    payload.queues = "unavailable";
    payload.queuesError = error instanceof Error ? error.message : String(error);
  }

  res.json(payload);
});

// /cron et /whatsapp sont protégés par un Bearer secret (cf. routes/index.ts).
// /webhooks reste public (appelé par des services externes sans notre secret).
app.use("/", routes);

(async () => {
  try {
    // Bull Board UI — dev only. Inspect queues at /ui.
    if (process.env.NODE_ENV !== "production") {
      const { createBullBoard } = await import("@bull-board/api");
      const { BullMQAdapter } = await import("@bull-board/api/bullMQAdapter");
      const { ExpressAdapter } = await import("@bull-board/express");

      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath("/ui");

      createBullBoard({
        queues: Object.values(queues).map((q) => new BullMQAdapter(q)),
        serverAdapter,
      });

      app.use("/ui", serverAdapter.getRouter());
      console.log(
        `[worker] Bull Board available at http://localhost:${PORT}/ui`,
      );
    }

    workers = await startAllWorkers();

    // Écoute permanente WhatsApp : capte en temps réel l'ajout du bot dans un
    // groupe pour auto-détecter le groupId. Best-effort (ne bloque pas le boot
    // si la session n'est pas encore appairée).
    startWhatsAppListener();

    server = app.listen(PORT, () => {
      console.log(`[worker] listening on ${PORT}`);
    });
  } catch (error) {
    console.error("[worker] failed to start", error);
    process.exit(1);
  }
})();

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[worker] ${signal} received, shutting down…`);

  if (server) {
    server.close(() => console.log("[worker] http server closed"));
  }

  // Ferme proprement le socket WhatsApp et stoppe la reconnexion auto.
  closeWhatsAppSocket();

  await Promise.all(
    workers.map(async (worker) => {
      try {
        await worker.close();
        console.log(`[worker] ${worker.name} closed`);
      } catch (error) {
        console.error(`[worker] error closing worker ${worker.name}`, error);
      }
    }),
  );

  try {
    await connection.quit();
    console.log("[worker] redis connection closed");
  } catch (error) {
    console.error("[worker] error closing redis", error);
  }

  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
