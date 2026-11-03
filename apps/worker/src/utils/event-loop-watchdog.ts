/**
 * Watchdog d'event loop — dernier filet quand la boucle principale est
 * totalement bloquée (spin synchrone, GC pathologique).
 *
 * Le 2026-11-03, le process worker a passé 2h35 à 1-2,4 vCPU sans servir une
 * seule requête : /health muet, zéro log, aucun timer déclenché — donc aucune
 * protection applicative (withTimeout, healthcheck) ne pouvait agir, et
 * Railway ne redémarre jamais un conteneur vivant. Résultat : ~3h d'ingestion
 * morte jusqu'à un restart manuel.
 *
 * Un worker thread possède sa propre event loop : il continue de tourner
 * pendant que la boucle principale est gelée. Le thread principal pose un
 * heartbeat dans un SharedArrayBuffer ; passé STALL_MS de silence, le thread
 * envoie SIGKILL au process entier. SIGKILL et pas autre chose :
 * `process.exit()` depuis un thread ne tue que le thread, et SIGTERM
 * déclencherait le shutdown graceful… qui a besoin de l'event loop morte.
 * Railway relance ensuite le conteneur (restartPolicy ON_FAILURE) :
 * panne de 3h → coupure de ~2 minutes.
 */
import { Worker as ThreadWorker } from 'node:worker_threads';

const HEARTBEAT_INTERVAL_MS = 5_000;

// Large marge : aucune opération légitime du worker ne bloque la boucle plus
// de quelques secondes (les travaux lourds sont des I/O awaités, pas du CPU).
const STALL_MS = 120_000;

// Code du thread en CommonJS évalué : tsx ne sait pas charger un .ts dans un
// worker thread sans loader dédié, et 10 lignes de JS inline évitent d'embarquer
// un fichier .js à part dans le build.
const WATCHDOG_THREAD_SOURCE = `
const { workerData } = require('node:worker_threads');
const { heartbeat, stallMs } = workerData;
setInterval(() => {
  const silenceMs = Date.now() - Number(Atomics.load(heartbeat, 0));
  if (silenceMs > stallMs) {
    console.error(
      '[watchdog] event loop principale silencieuse depuis ' + silenceMs +
      'ms — SIGKILL pour que Railway redémarre le worker',
    );
    process.kill(process.pid, 'SIGKILL');
  }
}, 10_000);
`;

export function startEventLoopWatchdog(): void {
  const heartbeat = new BigInt64Array(
    new SharedArrayBuffer(BigInt64Array.BYTES_PER_ELEMENT),
  );
  Atomics.store(heartbeat, 0, BigInt(Date.now()));

  const beat = setInterval(
    () => Atomics.store(heartbeat, 0, BigInt(Date.now())),
    HEARTBEAT_INTERVAL_MS,
  );

  // Ni le heartbeat ni le thread ne doivent retenir le process à l'arrêt :
  // au shutdown graceful, le process.exit(0) final les emporte.
  beat.unref();

  const thread = new ThreadWorker(WATCHDOG_THREAD_SOURCE, {
    eval: true,
    workerData: { heartbeat, stallMs: STALL_MS },
  });
  thread.unref();
}
