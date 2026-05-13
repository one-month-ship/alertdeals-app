'use client';

import { deleteAlert, fetchAccountAlerts, updateAlertStatus } from '@/actions/alert.actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { pages } from '@/config/routes';
import type { TAccountAlert } from '@/services/alert.service';
import { getErrorMessage } from '@/utils/error-messages.utils';
import { EAlertMode, EAlertStatus, type TAlertStatus } from '@alertdeals/shared';
import {
  Calendar,
  Gauge,
  Loader2,
  Mail,
  MapPin,
  Pause,
  Pencil,
  Phone,
  Play,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type { KeyedMutator } from 'swr';

type Props = {
  alert: TAccountAlert;
  onMutate: KeyedMutator<Awaited<ReturnType<typeof fetchAccountAlerts>>>;
};

const eurosFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const kmFormatter = new Intl.NumberFormat('fr-FR');

export function AlertCard({ alert, onMutate }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const isActive = alert.status === EAlertStatus.ACTIVE;

  const handleToggleStatus = async () => {
    setIsTogglingStatus(true);
    const newStatus: TAlertStatus = isActive ? EAlertStatus.PAUSED : EAlertStatus.ACTIVE;

    await onMutate(
      (current) => current?.map((a) => (a.id === alert.id ? { ...a, status: newStatus } : a)),
      { revalidate: false },
    );

    try {
      await updateAlertStatus(alert.id, newStatus);
      await onMutate();
    } catch (error) {
      await onMutate();
      toast.error(getErrorMessage(error));
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    await onMutate((current) => current?.filter((a) => a.id !== alert.id), {
      revalidate: false,
    });

    try {
      await deleteAlert(alert.id);
      await onMutate();
      toast.success('Alerte supprimée.');
    } catch (error) {
      await onMutate();
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const title =
    alert.name?.trim() ||
    [alert.brand?.name, alert.vehicleModel?.name].filter(Boolean).join(' ') ||
    'Alerte sans nom';

  const yearRange = formatRange(alert.modelYearMin, alert.modelYearMax);
  const mileageRange = formatRange(
    alert.mileageMin != null ? kmFormatter.format(alert.mileageMin) : null,
    alert.mileageMax != null ? kmFormatter.format(alert.mileageMax) : null,
    ' km',
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{title}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant={isActive ? 'default' : 'secondary'}>
                {isActive ? 'Active' : 'En pause'}
              </Badge>
              {alert.notificationChannels.email && (
                <Badge variant="outline" className="gap-1">
                  <Mail className="size-3" /> Email
                </Badge>
              )}
              {alert.notificationChannels.phone && (
                <Badge variant="outline" className="gap-1">
                  <Phone className="size-3" /> SMS
                </Badge>
              )}
            </div>
          </div>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Modifier l'alerte"
            className="size-8 shrink-0 rounded-full text-muted-foreground transition-all hover:scale-105 hover:bg-primary/10 hover:text-primary"
          >
            <Link href={pages.alerts.edit(alert.id)}>
              <Pencil className="size-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Target className="size-4 shrink-0" />
            <span>
              {alert.mode === EAlertMode.PRICE_MAX && alert.priceMax != null
                ? `Prix max : ${eurosFormatter.format(alert.priceMax)}`
                : alert.mode === EAlertMode.MARGIN_MIN && alert.marginMinPercentage != null
                  ? `Marge min : ${alert.marginMinPercentage}%`
                  : 'Critère non défini'}
            </span>
          </div>

          {alert.location?.name && (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" />
              <span className="truncate">
                {alert.location.name}
                {alert.radiusInKm != null && alert.radiusInKm > 0
                  ? ` · ${alert.radiusInKm} km`
                  : ''}
              </span>
            </div>
          )}

          {yearRange && (
            <div className="flex items-center gap-2">
              <Calendar className="size-4 shrink-0" />
              <span>Année : {yearRange}</span>
            </div>
          )}

          {mileageRange && (
            <div className="flex items-center gap-2">
              <Gauge className="size-4 shrink-0" />
              <span>Kilométrage : {mileageRange}</span>
            </div>
          )}

          {alert.priceMin != null && (
            <div className="flex items-center gap-2">
              <Wallet className="size-4 shrink-0" />
              <span>Prix min : {eurosFormatter.format(alert.priceMin)}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-end gap-1 border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleStatus}
          disabled={isTogglingStatus}
          className="gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          {isTogglingStatus ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isActive ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          {isActive ? 'Mettre en pause' : 'Activer'}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              className="gap-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Supprimer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette alerte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. L'alerte et son historique seront définitivement
                supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border bg-secondary text-secondary-foreground hover:bg-secondary/80">
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

function formatRange(
  min: number | string | null,
  max: number | string | null,
  suffix = '',
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min} – ${max}${suffix}`;
  if (min != null) return `≥ ${min}${suffix}`;
  return `≤ ${max}${suffix}`;
}
