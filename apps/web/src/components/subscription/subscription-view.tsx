"use client";

import {
  createBillingPortalSession,
  createCheckoutSession,
} from "@/actions/subscription.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getErrorMessage } from "@/utils/error-messages.utils";
import type { TPlan, TSubscription } from "@alertdeals/db";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  type TSubscriptionStatus,
} from "@alertdeals/shared";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  subscription: TSubscription | null;
  plans: TPlan[];
};

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Annulé",
};

// Subtle tone per status — green for healthy, amber for past_due, slate for ended/other.
// Slate also doubles as the fallback for any unmapped Stripe status code.
const FALLBACK_TONE = {
  dot: "bg-slate-400",
  text: "text-slate-300",
  bg: "bg-slate-500/10",
};
const STATUS_TONES: Record<string, typeof FALLBACK_TONE> = {
  active: {
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
  },
  past_due: {
    dot: "bg-amber-400",
    text: "text-amber-300",
    bg: "bg-amber-500/10",
  },
  canceled: FALLBACK_TONE,
};

// Prices are stored in cents in DB (Stripe convention); we show euros in French
// format with cents ("19,99"), dropping the decimals only when the amount is round.
function formatAmount(amountInCents: number): string {
  const euros = Math.floor(amountInCents / 100);
  const cents = amountInCents % 100;
  const base = euros.toLocaleString("fr-FR");
  return cents === 0 ? base : `${base},${String(cents).padStart(2, "0")}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SubscriptionView({ subscription, plans }: Props) {
  // We disable the action button using its identifier (priceId or "manage") so users can
  // see exactly which action is in flight when multiple are visible on screen.
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Default to "month" — most users land on the page expecting to see the monthly price first,
  // and the toggle lets them switch to "year" without changing the page hierarchy.
  const [selectedInterval, setSelectedInterval] = useState<"month" | "year">(
    "month",
  );

  // We render a single "pricing card" with a Mensuel/Annuel toggle when the user isn't subscribed.
  // Resolving each plan upfront keeps the toggle component free of `.find(...)` calls.
  const monthlyPlan = plans.find((plan) => plan.interval === "month");
  const yearlyPlan = plans.find((plan) => plan.interval === "year");

  const isActive = subscription
    ? ACTIVE_SUBSCRIPTION_STATUSES.includes(
        subscription.status as TSubscriptionStatus,
      )
    : false;

  // Look up the plan the user is subscribed to so we can display its name and price.
  // Fallback to undefined: the plan may have been retired from the catalog while the
  // user is grandfathered on its price — Stripe still bills, but we lose display data.
  const currentPlan = subscription
    ? plans.find((plan) => plan.stripePriceId === subscription.stripePriceId)
    : undefined;

  const handleSubscribe = async (priceId: string) => {
    setLoadingAction(priceId);
    const result = await createCheckoutSession(priceId);
    if ("error" in result) {
      toast.error(getErrorMessage(result.error));
      setLoadingAction(null);
      return;
    }
    if (result.url) {
      window.location.href = result.url;
      return;
    }
    setLoadingAction(null);
  };

  const handleManage = async () => {
    setLoadingAction("manage");
    const result = await createBillingPortalSession();
    if ("error" in result) {
      toast.error(getErrorMessage(result.error));
      setLoadingAction(null);
      return;
    }
    window.location.href = result.url;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Abonnement</h1>
        <p className="text-slate-400">Gère ton abonnement et ta facturation.</p>
      </div>

      {isActive && subscription ? (
        <Card className="relative overflow-hidden border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40">
          {/* Soft glow blob to give the card a subtle premium feel without becoming garish */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

          <CardContent className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                  <span className="text-xs font-medium uppercase tracking-wider text-indigo-300">
                    Plan actuel
                  </span>
                </div>
                <h2 className="text-2xl font-semibold text-slate-100">
                  {currentPlan?.name ?? "Abonnement"}
                </h2>
                {currentPlan && (
                  <p className="text-3xl font-bold text-slate-100">
                    {formatAmount(currentPlan.priceEur)}
                    <span className="ml-1 text-base font-normal text-slate-400">
                      € / {currentPlan.interval === "year" ? "an" : "mois"}
                    </span>
                  </p>
                )}
              </div>

              <StatusBadge status={subscription.status} />
            </div>

            <div className="my-6 h-px bg-slate-800" />

            <div className="flex items-center gap-2 text-sm text-slate-400">
              <CalendarDays className="h-4 w-4" />
              <span>
                Prochaine échéance le{" "}
                <span className="text-slate-200">
                  {formatDate(subscription.currentPeriodEnd)}
                </span>
              </span>
            </div>

            <Button
              onClick={handleManage}
              disabled={loadingAction !== null}
              className="mt-6 w-full sm:w-auto"
            >
              {loadingAction === "manage" ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Gérer mon abonnement
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PricingCardWithToggle
          monthlyPlan={monthlyPlan}
          yearlyPlan={yearlyPlan}
          selectedInterval={selectedInterval}
          setSelectedInterval={setSelectedInterval}
          loadingAction={loadingAction}
          onSubscribe={handleSubscribe}
        />
      )}
    </div>
  );
}

function PricingCardWithToggle(props: {
  monthlyPlan: TPlan | undefined;
  yearlyPlan: TPlan | undefined;
  selectedInterval: "month" | "year";
  setSelectedInterval: (interval: "month" | "year") => void;
  loadingAction: string | null;
  onSubscribe: (priceId: string) => void;
}) {
  const {
    monthlyPlan,
    yearlyPlan,
    selectedInterval,
    setSelectedInterval,
    loadingAction,
    onSubscribe,
  } = props;

  const selectedPlan = selectedInterval === "month" ? monthlyPlan : yearlyPlan;

  // Yearly "savings" badge — computed only if both intervals are configured.
  // Compares yearly to (monthly * 12) and shows the % discount, the standard
  // SaaS trick to nudge users toward annual.
  const savingsPercent =
    monthlyPlan && yearlyPlan
      ? Math.round(
          ((monthlyPlan.priceEur * 12 - yearlyPlan.priceEur) /
            (monthlyPlan.priceEur * 12)) *
            100,
        )
      : 0;
  const hasYearlySavings = savingsPercent > 0;

  // No plans synced yet (Stripe catalog empty or unreachable) — surface a neutral
  // message instead of an empty card, so QA / boss know it's a config issue not a bug.
  if (!monthlyPlan && !yearlyPlan) {
    return (
      <p className="text-sm text-slate-400">
        Aucun plan disponible pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toggle — only shown when both intervals exist. If only one is configured we
          skip the toggle entirely rather than render a useless single-option pill. */}
      {monthlyPlan && yearlyPlan && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/80 p-1 shadow-lg shadow-black/20 backdrop-blur">
            <button
              type="button"
              onClick={() => setSelectedInterval("month")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                selectedInterval === "month"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setSelectedInterval("year")}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all ${
                selectedInterval === "year"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Annuel
              {/* Petit pastille "économie" en haut à droite — ne s'affiche que si
                  l'annuel est vraiment moins cher */}
              {hasYearlySavings && (
                <span className="absolute -right-2 -top-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-950 shadow-sm">
                  −{savingsPercent}%
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {selectedPlan && (
        <Card className="relative mx-auto max-w-md overflow-hidden border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 shadow-2xl shadow-indigo-950/30">
          {/* Soft glow blob — same trick as the active-subscription card, gives a
              subtle premium feel without dominating the layout. */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

          <CardContent className="relative p-8">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-medium uppercase tracking-wider text-indigo-300">
                    {selectedPlan.name}
                  </span>
                </div>
                {selectedPlan.description && (
                  <p className="text-sm text-slate-400">
                    {selectedPlan.description}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight text-slate-100">
                    {formatAmount(selectedPlan.priceEur)}
                  </span>
                  <span className="text-2xl font-semibold text-slate-300">
                    €
                  </span>
                  <span className="ml-1 text-base font-normal text-slate-400">
                    / {selectedInterval === "year" ? "an" : "mois"}
                  </span>
                </div>
                {/* For the yearly plan, show the equivalent monthly rate — this is the
                    standard SaaS pricing cue that signals "annual is cheaper per month". */}
                {selectedInterval === "year" && (
                  <p className="mt-1 text-sm text-slate-400">
                    soit {formatAmount(Math.round(selectedPlan.priceEur / 12))}{" "}
                    € / mois
                  </p>
                )}
              </div>

              <div className="h-px bg-slate-800" />

              <ul className="space-y-3 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </span>
                  Alertes quotidiennes
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </span>
                  Filtres de recherche exhaustifs
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </span>
                  Numéros de téléphone disponibles
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </span>
                  Analyses avancées des véhicules
                </li>
              </ul>

              <Button
                onClick={() => onSubscribe(selectedPlan.stripePriceId)}
                disabled={loadingAction !== null}
                className="group w-full bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/40"
              >
                {loadingAction === selectedPlan.stripePriceId ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirection...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    S&apos;abonner
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Status pill: colored dot + label. Tones come from STATUS_TONES; falls back to slate
// for any unmapped status so we never crash on a future Stripe status code.
function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? FALLBACK_TONE;
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-medium ${tone.bg} ${tone.text}`}
    >
      <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${tone.dot}`} />
      {label}
    </span>
  );
}
