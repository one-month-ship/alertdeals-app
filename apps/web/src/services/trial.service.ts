import { createDrizzleSupabaseClient } from '@/lib/db';
import { hasActiveSubscription } from '@/services/subscription.service';
import { accounts, alerts, and, eq, isNull, sql } from '@alertdeals/db';
import {
  ESubscriptionErrorCode,
  TRIAL_DURATION_DAYS,
  TRIAL_MAX_ALERTS,
  type TAlertCreationBlockReason,
} from '@alertdeals/shared';

// Trial state machine — also returned to the banner so the UI can render
// the right copy + call-to-action without re-deriving the state on the client.
export type TTrialStatus =
  | { state: 'subscribed' } // active subscription, trial irrelevant
  | { state: 'not_started' } // brand-new account, hasn't created an alert yet
  | { state: 'active'; endDate: Date; daysRemaining: number } // 3-day window in progress
  | { state: 'expired' }; // window ran out and no subscription

/**
 * Single source of truth for the trial state. The banner and the alert gate
 * both call this so display + business logic stay consistent.
 */
export async function getTrialStatus(accountId: string): Promise<TTrialStatus> {
  const client = await createDrizzleSupabaseClient();

  // Both reads in parallel — independent. Delegating subscription check to its own service
  // means the storage source (hasSubscription column vs subscriptions table) can change
  // without touching trial logic.
  const [account, isSubscribed] = await Promise.all([
    client.rls((tx) =>
      tx.query.accounts.findFirst({
        where: eq(accounts.id, accountId),
        columns: { isTrial: true, trialEndDate: true },
      }),
    ),
    hasActiveSubscription(accountId),
  ]);

  if (isSubscribed) return { state: 'subscribed' };
  if (!account) return { state: 'expired' };

  if (account.isTrial && account.trialEndDate === null) {
    return { state: 'not_started' };
  }

  if (account.isTrial && account.trialEndDate && account.trialEndDate > new Date()) {
    const diffMs = account.trialEndDate.getTime() - Date.now();
    // ceil so "12h left" still shows as "1 day left" rather than "0" — friendlier UX.
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { state: 'active', endDate: account.trialEndDate, daysRemaining };
  }

  return { state: 'expired' };
}

/**
 * True when the account is allowed to create or activate an alert.
 * Called by the alert action as a single gate before insert.
 */
export async function canCreateAlert(accountId: string): Promise<boolean> {
  const status = await getTrialStatus(accountId);
  return (
    status.state === 'subscribed' ||
    status.state === 'not_started' ||
    status.state === 'active'
  );
}

/**
 * Gate complet de création d'alerte : essai/abonnement (comme canCreateAlert)
 * PLUS la limite anti-abus TRIAL_MAX_ALERTS pendant l'essai. Renvoie null quand
 * la création est permise, sinon la raison du blocage (code d'erreur à montrer).
 *
 * Distinct de canCreateAlert, qui reste le gate de la réactivation d'une alerte
 * existante et de l'accès complet aux hot deals : là, pas de limite de compte.
 */
export async function getAlertCreationBlock(
  accountId: string,
): Promise<TAlertCreationBlockReason | null> {
  const status = await getTrialStatus(accountId);

  if (status.state === 'subscribed') return null;
  if (status.state === 'expired') {
    return ESubscriptionErrorCode.SUBSCRIPTION_REQUIRED;
  }

  // Essai (démarré ou non) : plafonné à TRIAL_MAX_ALERTS alertes, tous statuts
  // confondus — une alerte en pause compte, sinon pause + création = contournement.
  const client = await createDrizzleSupabaseClient();
  const [row] = await client.rls((tx) =>
    tx
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(alerts)
      .where(eq(alerts.accountId, accountId)),
  );

  if ((row?.count ?? 0) >= TRIAL_MAX_ALERTS) {
    return ESubscriptionErrorCode.TRIAL_ALERT_LIMIT_REACHED;
  }

  return null;
}

/**
 * Starts the 3-day countdown on first alert creation. Idempotent by design —
 * the WHERE clause only matches when trialEndDate is still NULL, so subsequent
 * calls (or concurrent ones) never extend an in-progress trial.
 *
 * Renvoie true seulement quand c'est bien cet appel qui a démarré l'essai, pour que
 * l'appelant n'envoie l'événement marketing StartTrial qu'une seule fois.
 */
export async function startTrialCountdown(accountId: string): Promise<boolean> {
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);

  const client = await createDrizzleSupabaseClient();
  const started = await client.rls((tx) =>
    tx
      .update(accounts)
      .set({ trialEndDate })
      .where(and(eq(accounts.id, accountId), isNull(accounts.trialEndDate)))
      .returning({ id: accounts.id }),
  );

  return started.length > 0;
}
