import {
  alerts as alertsTable,
  eq,
  getDBAdminClient,
  matchedAds as matchedAdsTable,
} from "@alertdeals/db";
import { EAlertStatus } from "@alertdeals/shared";
import { Job } from "bullmq";
import { DAILY_ORCHESTRATOR_JOB_TIMEOUT_MS } from "../config/index.js";
import { expireTrials } from "../services/expire-trials.service.js";
import { findMatchedAdIdsForAccount } from "../services/matching.service.js";
import { dispatchAlertMatchNotifications } from "../services/notification.service.js";
import { pauseUnsubscribedAlerts } from "../services/pause-unsubscribed-alerts.service.js";
import { withTimeout } from "../utils/general.utils.js";

interface DailyOrchestratorJob {
  triggeredAt: string;
  source: string;
}

/**
 * Bounded so a hung DB round-trip can't leave the job `active` forever and
 * stall the queue — see SCRAPING_JOB_TIMEOUT_MS for the full rationale.
 */
export async function dailyOrchestratorWorker(job: Job<DailyOrchestratorJob>) {
  return withTimeout(
    runDailyOrchestrator(),
    DAILY_ORCHESTRATOR_JOB_TIMEOUT_MS,
    `[daily-orchestrator] job ${job.id}`,
  );
}

async function runDailyOrchestrator() {
  const startTime = Date.now();
  const db = getDBAdminClient();

  // Run trial expiration FIRST so any alerts paused on this run are excluded from matching below.
  const expired = await expireTrials(db);

  // Defensive sweep AFTER trial expiry (so freshly-expired accounts are already
  // isTrial=false) and BEFORE matching: pauses alerts of non-trial accounts whose
  // subscription lapsed. Safety net for missed/failed Stripe webhooks and for
  // `past_due` subscriptions that never emit a `deleted` event.
  const unsubscribed = await pauseUnsubscribedAlerts(db);

  const activeAlerts = await db.query.alerts.findMany({
    where: eq(alertsTable.status, EAlertStatus.ACTIVE),
    // brands/models are required for filtering — they live in M:N tables (alert_brands / alert_models)
    // since the form went multi-select. Fetching them here keeps the matcher's logic pure.
    // `account` est chargé en plus pour récupérer l'email + whatsappPhoneNumber/
    // whatsappIsGroup, utilisés par notification.service pour router les notifs
    // email (Resend) et WhatsApp.
    with: { location: true, brands: true, models: true, account: true },
  });

  if (activeAlerts.length === 0) {
    return {
      matchedRows: 0,
      accountsProcessed: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // Regroupement par compte pour matcher chaque user contre toutes ses alertes
  // en un seul appel à matching.service (limite les round-trips DB).
  const alertsByAccount = new Map<string, typeof activeAlerts>();
  for (const alert of activeAlerts) {
    const list = alertsByAccount.get(alert.accountId) ?? [];
    list.push(alert);
    alertsByAccount.set(alert.accountId, list);
  }

  let totalInserted = 0;
  let totalNotificationsDispatched = 0;
  let accountsProcessed = 0;

  for (const [accountId, accountAlerts] of alertsByAccount) {
    accountsProcessed += 1;

    try {
      const matches = await findMatchedAdIdsForAccount(accountAlerts);
      if (matches.length === 0) continue;

      // Dédup par adId — la contrainte UNIQUE(accountId, adId) sur matched_ads
      // veut une seule row par (compte, ad), même si l'ad matche plusieurs alertes.
      // Le 1er alertId rencontré gagne, les autres sont ignorés.
      const seenAdIds = new Set<string>();
      const rowsToInsert: {
        accountId: string;
        alertId: string;
        adId: string;
      }[] = [];
      for (const { adId, alertId } of matches) {
        if (seenAdIds.has(adId)) continue;
        seenAdIds.add(adId);
        rowsToInsert.push({ accountId, alertId, adId });
      }

      // `onConflictDoNothing` + `returning` → la liste retournée contient
      // uniquement les NEW rows. Les ads déjà matchées dans une run précédente
      // ne sont pas retournées et donc pas re-notifiées.
      const inserted = await db
        .insert(matchedAdsTable)
        .values(rowsToInsert)
        .onConflictDoNothing({
          target: [matchedAdsTable.accountId, matchedAdsTable.adId],
        })
        .returning({
          id: matchedAdsTable.id,
          alertId: matchedAdsTable.alertId,
        });

      totalInserted += inserted.length;
      if (inserted.length === 0) continue;

      // Comptage des nouveaux matches par alerte pour générer une notif par alerte
      // (et pas une par match — sinon on spam le user).
      const newMatchesByAlert = new Map<string, number>();
      for (const row of inserted) {
        // `alertId` est nullable en base (une matched_ad peut survivre à la
        // suppression de son alerte via ON DELETE set null), mais ici on vient
        // de l'insérer avec un alertId défini → on ignore le cas null par sûreté.
        if (!row.alertId) continue;
        newMatchesByAlert.set(
          row.alertId,
          (newMatchesByAlert.get(row.alertId) ?? 0) + 1,
        );
      }

      // Dispatch des notifs. On retrouve l'alerte complète depuis
      // `accountAlerts` pour avoir le `name` et `notificationChannels`,
      // et on prend l'account depuis n'importe quelle alerte du groupe
      // (toutes partagent le même account → mêmes email/WhatsApp).
      const account = accountAlerts[0]?.account;
      if (!account) continue;
      const alertsById = new Map(accountAlerts.map((a) => [a.id, a]));
      for (const [alertId, newMatchesCount] of newMatchesByAlert) {
        const alert = alertsById.get(alertId);
        if (!alert) continue;
        dispatchAlertMatchNotifications({
          accountId,
          account,
          alert,
          newMatchesCount,
        });
        totalNotificationsDispatched += 1;
      }
    } catch (error) {
      console.error(
        `[daily-orchestrator] failed for account ${accountId}`,
        error,
      );
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    matchedRows: totalInserted,
    accountsProcessed,
    notificationsDispatched: totalNotificationsDispatched,
    durationMs,
  };
}
