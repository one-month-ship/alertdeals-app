"use server";

import { pages } from "@/config/routes";
import { stripe } from "@/lib/stripe";
import { getUserAccount } from "@/services/account.service";
import { getStripeCustomerId } from "@/services/subscription.service";
import { ESubscriptionErrorCode, type TErrorCode } from "@alertdeals/shared";

if (!process.env.NEXT_PUBLIC_SITE_URL) {
  throw new Error("NEXT_PUBLIC_SITE_URL is not set");
}
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

type TCheckoutResult = { url: string | null } | { error: TErrorCode };

/**
 * Creates a Stripe Checkout session for a subscription plan.
 * `priceId` is taken as a parameter so we can support multiple plans later
 * without changing this action — the plans route decides which prices are visible.
 *
 * Returns the hosted checkout URL the client must redirect to.
 */
export async function createCheckoutSession(
  priceId: string,
): Promise<TCheckoutResult> {
  try {
    const account = await getUserAccount({
      columnsToKeep: { id: true, email: true },
    });

    // Reuse an existing Stripe customer when possible — otherwise let Stripe create one
    // from the email, and we'll persist the new customer ID via the webhook.
    const stripeCustomerId = await getStripeCustomerId(account.id);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${SITE_URL}${pages.subscription}?status=success`,
      cancel_url: `${SITE_URL}${pages.subscription}?status=cancel`,
      customer_email: stripeCustomerId ? undefined : account.email,
      customer: stripeCustomerId || undefined,
      allow_promotion_codes: true,
      // accountId travels with the session so the webhook can link the new
      // subscription/customer back to the right account on completion.
      metadata: { accountId: account.id },
    });

    return { url: session.url };
  } catch {
    // Never leak Stripe error details to the client (PII, internal IDs, etc.).
    return { error: ESubscriptionErrorCode.CHECKOUT_FAILED };
  }
}

type TBillingPortalResult = { url: string } | { error: TErrorCode };

/**
 * Creates a Stripe Billing Portal session so the user can manage / cancel
 * their subscription. Requires an existing Stripe customer — fails cleanly otherwise.
 */
export async function createBillingPortalSession(): Promise<TBillingPortalResult> {
  try {
    const account = await getUserAccount({ columnsToKeep: { id: true } });

    const stripeCustomerId = await getStripeCustomerId(account.id);
    if (!stripeCustomerId) {
      return { error: ESubscriptionErrorCode.NO_ACTIVE_CUSTOMER };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${SITE_URL}${pages.subscription}`,
    });

    return { url: session.url };
  } catch {
    return { error: ESubscriptionErrorCode.BILLING_PORTAL_FAILED };
  }
}
