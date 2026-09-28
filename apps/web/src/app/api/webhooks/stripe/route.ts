import {
  accounts,
  alerts,
  and,
  billingCustomers,
  eq,
  getDBAdminClient,
  inArray,
  subscriptions,
} from '@alertdeals/db';
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  EAlertStatus,
  ESubscriptionStatus,
} from '@alertdeals/shared';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { stripe } from '@/lib/stripe';
import { recordSubscription } from '@/services/marketing.service';

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET is not set');
}
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// In Stripe SDK v18+, `current_period_end` lives on subscription items, not on the
// subscription object. Fallback to "now" only if Stripe sent us something incomplete —
// in practice this should never happen for an active subscription.
function getCurrentPeriodEnd(subscription: Stripe.Subscription): Date {
  const periodEndUnix =
    subscription.items.data[0]?.current_period_end ?? Math.floor(Date.now() / 1000);
  return new Date(periodEndUnix * 1000);
}

/**
 * Stripe webhook. Idempotent by design — every handler upserts on the unique
 * `stripeSubscriptionId`, so Stripe's retries never produce duplicates.
 *
 * Events handled:
 *  - checkout.session.completed   → link Stripe customer to account, insert subscription row
 *  - customer.subscription.updated → keep status + period end in sync (renewals, past_due, etc.)
 *  - customer.subscription.deleted → mark as canceled + pause the account's active
 *    alerts (unless the account is still in a valid trial or has another active
 *    subscription). The daily orchestrator sweep double-checks this in case the
 *    webhook is missed.
 *
 * Any other event is acknowledged but ignored — we don't want Stripe to retry events
 * we don't care about (would clog the queue and slow down legitimate ones).
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    // Invalid signature = either a misconfigured webhook secret, or someone forging
    // a request. Either way, refuse silently — never leak details.
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Webhooks are called server-to-server by Stripe — there is no user JWT, so RLS
  // would block all writes. Admin client is the only correct choice here.
  const db = getDBAdminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const accountId = session.metadata?.accountId;

      // Defensive: a missing accountId means the checkout was created outside our
      // server actions — skip rather than crash, and let an operator investigate.
      if (!accountId || !session.subscription || !session.customer) break;

      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;

      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer.id;

      // Pull the full subscription to grab status + period end + the actual priceId
      // (the checkout session's `line_items` aren't returned here by default).
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = stripeSubscription.items.data[0]?.price.id;
      if (!priceId) break;

      // Link the Stripe customer to the account so future checkouts reuse it
      // (and so getStripeCustomerId() finds it).
      await db
        .insert(billingCustomers)
        .values({ accountId, stripeCustomerId: customerId })
        .onConflictDoNothing();

      // Upsert on stripeSubscriptionId — protects against Stripe retrying the event.
      await db
        .insert(subscriptions)
        .values({
          accountId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: priceId,
          status: stripeSubscription.status,
          currentPeriodEnd: getCurrentPeriodEnd(stripeSubscription),
        })
        .onConflictDoUpdate({
          target: subscriptions.stripeSubscriptionId,
          set: {
            stripePriceId: priceId,
            status: stripeSubscription.status,
            currentPeriodEnd: getCurrentPeriodEnd(stripeSubscription),
          },
        });

      // Événement Meta Subscribe (pixel côté serveur, ne lève jamais)
      await recordSubscription({
        accountId,
        sessionId: session.id,
        subscriptionId,
        amountTotal: session.amount_total,
        currency: session.currency,
      });

      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price.id;

      await db
        .update(subscriptions)
        .set({
          status: subscription.status,
          currentPeriodEnd: getCurrentPeriodEnd(subscription),
          // Update the priceId too: a plan change (upgrade/downgrade in Customer
          // Portal) keeps the same subscription ID but swaps the price.
          ...(priceId ? { stripePriceId: priceId } : {}),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      const updated = await db
        .update(subscriptions)
        .set({ status: ESubscriptionStatus.CANCELED })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
        .returning({ accountId: subscriptions.accountId });

      // Unknown subscription (row never created?) — nothing more we can do.
      const accountId = updated[0]?.accountId;
      if (!accountId) break;

      // Defensive: single-plan today, but if the account somehow holds another
      // still-active subscription, keep its alerts running.
      const otherActiveSubscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.accountId, accountId),
          inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES),
        ),
        columns: { id: true },
      });
      if (otherActiveSubscription) break;

      // A valid trial grants access on its own — no subscription required.
      // Trial expiry itself is handled by the worker's expire-trials cron.
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, accountId),
        columns: { isTrial: true, trialEndDate: true },
      });
      const isInValidTrial =
        account?.isTrial === true &&
        (account.trialEndDate === null || account.trialEndDate > new Date());
      if (isInValidTrial) break;

      // No active subscription, no valid trial → stop notifying immediately.
      // The daily orchestrator sweep would catch this anyway, but pausing here
      // avoids up to a day of free notifications between two cron runs.
      await db
        .update(alerts)
        .set({ status: EAlertStatus.PAUSED })
        .where(
          and(
            eq(alerts.accountId, accountId),
            eq(alerts.status, EAlertStatus.ACTIVE),
          ),
        );
      break;
    }
  }

  return NextResponse.json({ received: true });
}
