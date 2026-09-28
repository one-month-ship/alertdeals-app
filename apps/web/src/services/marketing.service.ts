import 'server-only';

import { metaCapiConfig } from '@/config/marketing.config';
import { getSiteUrl } from '@/utils/get-site-url';
import { accounts, eq, getDBAdminClient } from '@alertdeals/db';
import { attributionConfig, TAccountAttribution } from '@alertdeals/shared';
import { createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';

// Noms d'événements standards Meta. L'intitulé n'influence pas l'apprentissage de
// l'algorithme (il optimise sur le signal, pas sur le mot), mais il détermine les
// colonnes de reporting d'Ads Manager : on le fait donc correspondre à la réalité.
//   CompleteRegistration → inscription (objectif de la première campagne)
//   StartTrial           → première alerte créée = activation réelle du produit
//   Subscribe            → abonnement payé
type TMetaEventName = 'CompleteRegistration' | 'StartTrial' | 'Subscribe';

type TMetaEventInput = {
  eventName: TMetaEventName;
  /** Identifiant stable pour que Meta déduplique les rejeux (ex : redelivery Stripe) */
  eventId: string;
  email: string;
  accountId: string;
  attribution?: TAccountAttribution | null;
  /** Disponible seulement quand l'événement part d'une requête utilisateur, pas d'un webhook */
  client?: { ip?: string | null; userAgent?: string | null };
  /** Identifiant d'abonnement Stripe, paramètre `subscription_id` optionnel de Meta */
  subscriptionId?: string;
  customData?: { currency?: string; value?: number };
};

/* ---------- Cookie d'attribution ---------- */

/** Lit le cookie d'attribution posé par le proxy, s'il existe. */
export async function readAttributionCookie(): Promise<TAccountAttribution | null> {
  const raw = (await cookies()).get(attributionConfig.cookieName)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TAccountAttribution;
    return parsed.capturedAt ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Première connexion uniquement : persiste l'attribution de la landing sur le compte
 * et remonte l'inscription à Meta. Ne lève jamais — le marketing ne doit pas casser
 * la connexion.
 *
 * C'est l'inscription qui est l'événement de conversion à optimiser, pas le démarrage
 * de l'essai : l'essai est indépendant de l'inscription (il ne démarre qu'à la première
 * alerte, parfois des jours plus tard, quand le cookie d'attribution a pu expirer).
 * L'activation réelle est suivie séparément par recordTrialStart.
 */
export async function recordSignup(account: {
  id: string;
  email: string;
}): Promise<void> {
  const attribution = await readAttributionCookie();

  // Persistance et événement Meta sont indépendants : un échec en base ne doit pas
  // faire perdre l'événement marketing, et inversement.
  if (attribution) {
    try {
      const db = getDBAdminClient();
      await db.update(accounts).set({ attribution }).where(eq(accounts.id, account.id));
    } catch (error) {
      console.error('[marketing.service] attribution persistence failed', {
        accountId: account.id,
        error,
      });
    }
  }

  try {
    const requestHeaders = await headers();
    await sendMetaEvent({
      eventName: 'CompleteRegistration',
      eventId: `signup_${account.id}`,
      email: account.email,
      accountId: account.id,
      attribution,
      client: {
        ip: requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim(),
        userAgent: requestHeaders.get('user-agent'),
      },
    });
  } catch (error) {
    console.error('[marketing.service] CompleteRegistration event failed', {
      accountId: account.id,
      error,
    });
  }
}

/**
 * Appelé quand le compte à rebours d'essai vient réellement de démarrer (première
 * alerte créée) : c'est la mesure d'activation, pas l'objectif d'optimisation de la
 * première campagne. L'attribution est relue en base, car elle a pu être capturée
 * plusieurs jours plus tôt (le cookie, lui, a expiré).
 * Ne lève jamais — la création d'alerte ne doit pas échouer pour une raison marketing.
 */
export async function recordTrialStart(accountId: string): Promise<void> {
  try {
    const db = getDBAdminClient();
    const account = await db.query.accounts.findFirst({
      columns: { email: true, attribution: true },
      where: eq(accounts.id, accountId),
    });
    if (!account) return;

    const requestHeaders = await headers();
    await sendMetaEvent({
      eventName: 'StartTrial',
      eventId: `start_trial_${accountId}`,
      email: account.email,
      accountId,
      attribution: account.attribution,
      client: {
        ip: requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim(),
        userAgent: requestHeaders.get('user-agent'),
      },
    });
  } catch (error) {
    console.error('[marketing.service] recordTrialStart failed', { accountId, error });
  }
}

/**
 * Appelé depuis le webhook Stripe dès qu'un checkout d'abonnement est payé.
 * Ne lève jamais — le webhook doit continuer à acquitter auprès de Stripe.
 */
export async function recordSubscription(input: {
  accountId: string;
  /** Identifiant de la session de checkout Stripe, réutilisé comme event id pour la dédup */
  sessionId: string;
  subscriptionId: string;
  amountTotal: number | null;
  currency: string | null;
}): Promise<void> {
  try {
    const db = getDBAdminClient();
    const account = await db.query.accounts.findFirst({
      columns: { email: true, attribution: true },
      where: eq(accounts.id, input.accountId),
    });
    if (!account) return;

    await sendMetaEvent({
      eventName: 'Subscribe',
      eventId: `subscribe_${input.sessionId}`,
      email: account.email,
      accountId: input.accountId,
      attribution: account.attribution,
      subscriptionId: input.subscriptionId,
      customData: {
        currency: input.currency?.toUpperCase(),
        // Stripe exprime les montants en centimes
        value: input.amountTotal != null ? input.amountTotal / 100 : undefined,
      },
    });
  } catch (error) {
    console.error('[marketing.service] recordSubscription failed', {
      accountId: input.accountId,
      error,
    });
  }
}

/* ---------- Meta Conversions API ---------- */

const sha256 = (value: string) =>
  createHash('sha256').update(value.trim().toLowerCase()).digest('hex');

/** Format `fbc` de Meta quand l'identifiant de clic a été capturé dans l'URL : fb.1.<ms>.<fbclid> */
const buildFbc = (attribution?: TAccountAttribution | null) => {
  if (!attribution?.fbclid) return undefined;
  const capturedMs = Date.parse(attribution.capturedAt) || Date.now();
  return `fb.1.${capturedMs}.${attribution.fbclid}`;
};

/**
 * Envoie un événement à la Meta Conversions API. Fire-and-forget : logue et rend la
 * main en cas d'échec, ne lève jamais.
 * https://developers.facebook.com/docs/marketing-api/conversions-api
 */
async function sendMetaEvent(input: TMetaEventInput): Promise<void> {
  if (!metaCapiConfig.enabled) {
    console.warn(
      '[marketing.service] Meta CAPI disabled - missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN',
      { eventName: input.eventName },
    );
    return;
  }

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: getSiteUrl(),
        user_data: {
          em: [sha256(input.email)],
          external_id: [sha256(input.accountId)],
          client_ip_address: input.client?.ip || undefined,
          client_user_agent: input.client?.userAgent || undefined,
          fbc: buildFbc(input.attribution),
          subscription_id: input.subscriptionId,
        },
        custom_data: input.customData,
      },
    ],
    ...(metaCapiConfig.testEventCode && {
      test_event_code: metaCapiConfig.testEventCode,
    }),
    access_token: metaCapiConfig.accessToken,
  };

  try {
    const res = await fetch(metaCapiConfig.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[marketing.service] Meta CAPI rejected event', {
        eventName: input.eventName,
        status: res.status,
        body: await res.text(),
      });
    }
  } catch (error) {
    // Un échec marketing ne doit jamais casser le parcours utilisateur
    console.error('[marketing.service] Meta CAPI call failed', {
      eventName: input.eventName,
      error,
    });
  }
}
