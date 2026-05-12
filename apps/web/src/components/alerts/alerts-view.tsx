'use client';

import { fetchAccountAlerts } from '@/actions/alert.actions';
import { AlertCard } from '@/components/alerts/alert-card';
import { Button } from '@/components/ui/button';
import { pages } from '@/config/routes';
import type { TAccountAlert } from '@/services/alert.service';
import { Bell, Plus } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

type Props = {
  alerts: TAccountAlert[];
};

export function AlertsView({ alerts: initialAlerts }: Props) {
  const { data: alerts = initialAlerts, mutate } = useSWR(
    'account-alerts',
    () => fetchAccountAlerts(),
    {
      fallbackData: initialAlerts,
      revalidateOnFocus: true,
    },
  );

  return (
    <div className="px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Alertes</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gère tes alertes de prix et de marge sur les véhicules.
          </p>
        </div>
        <Button
          asChild
          className="group relative bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
        >
          <Link href={pages.alerts.new}>
            <span className="flex size-5 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:rotate-90">
              <Plus className="size-3.5" />
            </span>
            Nouvelle alerte
          </Link>
        </Button>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center">
          <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-white/5">
            <Bell className="size-6 text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">Aucune alerte</h3>
          <p className="mb-6 text-sm text-slate-400">
            Crée ta première alerte pour être notifié dès qu'une annonce correspond à tes critères.
          </p>
          <Button
            asChild
            size="lg"
            className="group relative bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
          >
            <Link href={pages.alerts.new}>
              <span className="flex size-5 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:rotate-90">
                <Plus className="size-3.5" />
              </span>
              Créer une alerte
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onMutate={mutate} />
          ))}
        </div>
      )}
    </div>
  );
}
