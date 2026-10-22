import { EWhatsAppErrorCode } from '@alertdeals/shared';
import {
  CredentialConnectionResult,
  connectWithCredentials,
  loadStoredCredentials,
  markWhatsAppAsDisconnected,
  onWhatsAppGroupAdded,
  persistWhatsAppCredentials,
  type WASocket,
} from '@alertdeals/whatsapp';
import { handleDetectedGroup } from './whatsapp-group.service.js';

// Singleton socket pour ce process worker. Lazy : on ne se connecte qu'à
// la première demande d'envoi — ça évite de planter le boot du worker si
// le pairing n'a pas encore eu lieu (env nouvellement déployé, session
// révoquée, etc.).
let socketPromise: Promise<WASocket> | null = null;
let activeConnection: CredentialConnectionResult | null = null;

// Quand true, on garde une connexion ouverte en permanence (pas juste à
// l'envoi) pour capter en temps réel l'ajout du bot dans un groupe. Activé par
// startWhatsAppListener() au démarrage du worker.
let keepAlive = false;

// Délai avant tentative de reconnexion après une coupure, quand keepAlive est
// actif. Laisse le temps au réseau de revenir sans marteler WhatsApp.
const RECONNECT_DELAY_MS = 5_000;

// Au-delà, on arrête de retenter en mode keepAlive : une session morte
// (device retiré côté téléphone) ne se répare pas en reconnectant, et la
// boucle noyait les logs du worker — c'est ce qui a masqué 6 jours de panne
// d'ingestion le 16/10/2026. L'envoi de notif reste en mode lazy et retentera
// à la demande ; un re-pairing (`pnpm pair-whatsapp`) relance l'écoute.
const MAX_KEEPALIVE_RECONNECT_ATTEMPTS = 5;

// Backoff exponentiel plafonné entre deux tentatives keepAlive.
const MAX_RECONNECT_DELAY_MS = 300_000;

let keepAliveReconnectAttempts = 0;

/**
 * Récupère le socket WhatsApp prêt à envoyer. Réutilise la connexion en
 * cours si elle est ouverte, sinon en ouvre une nouvelle via la session
 * encryptée stockée en DB.
 *
 * Throw :
 *  - `SESSION_NOT_PAIRED` si la table `whatsapp_sessions` est vide → il faut
 *    lancer `pnpm pair-whatsapp` avant.
 *  - `MESSAGE_SEND_FAILED` si la connexion n'aboutit pas (transient ou
 *    permanente — voir markWhatsAppAsDisconnected pour le distinguer en DB).
 */
export async function getWhatsAppSocket(): Promise<WASocket> {
  if (socketPromise) return socketPromise;
  socketPromise = openConnection();
  return socketPromise;
}

async function openConnection(): Promise<WASocket> {
  const storedState = await loadStoredCredentials();
  if (!storedState) {
    // Libère le singleton avant de throw — le prochain appel pourra retenter
    // (par exemple après que le boss ait fait `pnpm pair-whatsapp`).
    socketPromise = null;
    throw new Error(EWhatsAppErrorCode.SESSION_NOT_PAIRED);
  }

  const conn = await connectWithCredentials(storedState);
  const result = await conn.waitForConnection();

  if (!result.connected) {
    // permanent = loggedOut / badSession / forbidden : la session est morte,
    // on marque la row en DB et on attend un re-pair. transient = on
    // libère juste le singleton, l'appel suivant retentera.
    if (result.permanent) {
      await markWhatsAppAsDisconnected();
      // Session morte : inutile de garder l'écoute permanente active, elle
      // bouclerait indéfiniment sur un 401. On repasse en lazy.
      keepAlive = false;
      console.error(
        '[whatsapp.service] session morte (device retiré ?) — écoute permanente arrêtée, re-pairing requis',
      );
    }
    conn.cleanup();
    socketPromise = null;
    throw new Error(EWhatsAppErrorCode.MESSAGE_SEND_FAILED);
  }

  activeConnection = conn;

  // Connexion rétablie : on repart d'un compteur neuf pour que le plafond
  // s'applique aux échecs *consécutifs*, pas au cumul de la vie du process.
  keepAliveReconnectAttempts = 0;

  // Détection automatique des groupes : dès que notre numéro est ajouté à un
  // groupe, on relie le groupe au compte (via le numéro de l'auteur) et on le
  // stocke. handleDetectedGroup ne throw pas, l'écouteur est donc sûr.
  onWhatsAppGroupAdded(conn.socket, handleDetectedGroup);

  // Persiste immédiatement les credentials post-connect : Baileys peut avoir
  // rafraîchi des clés pendant le handshake, et on veut que le prochain boot
  // reload une session à jour.
  try {
    await persistWhatsAppCredentials(conn.saveState());
  } catch (error) {
    console.error('[whatsapp.service] post-connect persist failed', error);
  }

  // Pendant la vie du socket, Baileys peut renouveler des clés en background ;
  // on resave à chaque event pour ne pas perdre l'état si le worker redémarre.
  conn.socket.ev.on('creds.update', async () => {
    try {
      await persistWhatsAppCredentials(conn.saveState());
    } catch (error) {
      console.error('[whatsapp.service] creds.update persist failed', error);
    }
  });

  // Si le socket ferme en cours de route (réseau, restart, etc.), on libère
  // le singleton pour que le prochain getWhatsAppSocket() retente proprement.
  conn.socket.ev.on('connection.update', (update) => {
    if (update.connection === 'close') {
      console.warn('[whatsapp.service] socket closed, will reconnect on demand');
      socketPromise = null;
      activeConnection = null;

      // En mode écoute permanente, on ne peut pas attendre le prochain envoi
      // pour rouvrir : on relance une connexion après un court délai pour
      // continuer à capter les ajouts de groupes. Un échec (non appairé,
      // session morte) est avalé — le prochain envoi retentera de toute façon.
      if (keepAlive) {
        if (keepAliveReconnectAttempts >= MAX_KEEPALIVE_RECONNECT_ATTEMPTS) {
          keepAlive = false;
          console.error(
            `[whatsapp.service] ${keepAliveReconnectAttempts} reconnexions échouées — écoute permanente arrêtée (re-pairing requis)`,
          );
          return;
        }

        // Backoff exponentiel : évite de marteler WhatsApp et de saturer les
        // logs quand la coupure dure.
        const delay = Math.min(
          RECONNECT_DELAY_MS * 2 ** keepAliveReconnectAttempts,
          MAX_RECONNECT_DELAY_MS,
        );
        keepAliveReconnectAttempts += 1;

        setTimeout(() => {
          void getWhatsAppSocket().catch((error) => {
            console.warn(
              '[whatsapp.service] reconnect attempt failed',
              error instanceof Error ? error.message : error,
            );
          });
        }, delay);
      }
    }
  });

  return conn.socket;
}

/**
 * Démarre l'écoute permanente WhatsApp au boot du worker. Ouvre la connexion
 * (best-effort) pour capter en temps réel l'ajout du bot dans des groupes.
 *
 * Ne throw pas : si la session n'est pas encore appairée, on loggue et on
 * laisse l'envoi de notif rouvrir la connexion plus tard (mode lazy).
 */
export function startWhatsAppListener(): void {
  keepAlive = true;
  void getWhatsAppSocket().catch((error) => {
    console.warn(
      '[whatsapp.service] écoute groupes non démarrée (session non appairée ?)',
      error instanceof Error ? error.message : error,
    );
  });
}

/**
 * Ferme proprement le socket et libère le singleton. À appeler depuis le
 * graceful shutdown du worker pour éviter de laisser une connexion zombie.
 */
export function closeWhatsAppSocket(): void {
  // Coupe l'écoute permanente d'abord, sinon le handler de fermeture
  // relancerait une reconnexion en plein arrêt du worker.
  keepAlive = false;
  if (activeConnection) {
    activeConnection.cleanup();
    activeConnection = null;
    socketPromise = null;
  }
}
