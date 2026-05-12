'use server';

import { createClient } from '@/lib/supabase/server';
import { getAccountAlerts } from '@/services/alert.service';
import { alertFormSchema, createAlertSchema } from '@/validation-schemas';
import { accounts, alerts, and, eq, getDBAdminClient } from '@alertdeals/db';
import { EAlertStatus, type TAlertStatus } from '@alertdeals/shared';
import { revalidatePath } from 'next/cache';

type AlertMutationResult =
  | { success: true; alertId: string }
  | { success: false; error: string };

async function getCurrentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Vous devez être connecté.');
  return user.id;
}

export async function createAlert(data: unknown): Promise<AlertMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Vous devez être connecté pour créer une alerte.' };
  }

  const parseResult = createAlertSchema.safeParse(data);
  if (!parseResult.success) {
    return { success: false, error: 'Les informations saisies ne sont pas valides.' };
  }
  const validated = parseResult.data;

  const db = getDBAdminClient();

  const [account] = await db
    .select({ hasSubscription: accounts.hasSubscription })
    .from(accounts)
    .where(eq(accounts.id, user.id))
    .limit(1);

  if (!account) {
    return { success: false, error: 'Compte introuvable.' };
  }
  if (!account.hasSubscription) {
    return {
      success: false,
      error: 'Un abonnement actif est requis pour créer une alerte.',
    };
  }

  try {
    const [created] = await db
      .insert(alerts)
      .values({
        accountId: user.id,
        name: validated.name ?? null,
        brandId: validated.brandId ?? null,
        modelId: validated.modelId ?? null,
        locationId: validated.locationId ?? null,
        radiusInKm: validated.radiusInKm ?? null,
        modelYearMin: validated.modelYearMin ?? null,
        modelYearMax: validated.modelYearMax ?? null,
        mileageMin: validated.mileageMin ?? null,
        mileageMax: validated.mileageMax ?? null,
        priceMin: validated.priceMin ?? null,
        mode: validated.mode,
        priceMax: validated.priceMax ?? null,
        marginMinPercentage: validated.marginMinPercentage ?? null,
        notificationChannels: validated.notificationChannels,
      })
      .returning({ id: alerts.id });

    if (!created) {
      return { success: false, error: "L'alerte n'a pas pu être enregistrée." };
    }

    revalidatePath('/alerts');

    return { success: true, alertId: created.id };
  } catch {
    return { success: false, error: "Impossible d'enregistrer l'alerte. Veuillez réessayer." };
  }
}

export async function fetchAccountAlerts() {
  return getAccountAlerts();
}

export async function updateAlert(
  alertId: string,
  data: unknown,
): Promise<AlertMutationResult> {
  const accountId = await getCurrentUserId().catch(() => null);
  if (!accountId) {
    return { success: false, error: 'Vous devez être connecté pour modifier une alerte.' };
  }

  const parseResult = alertFormSchema.safeParse(data);
  if (!parseResult.success) {
    return { success: false, error: 'Les informations saisies ne sont pas valides.' };
  }
  const validated = parseResult.data;

  const db = getDBAdminClient();

  try {
    const [updated] = await db
      .update(alerts)
      .set({
        name: validated.name ?? null,
        brandId: validated.brandId ?? null,
        modelId: validated.modelId ?? null,
        locationId: validated.locationId ?? null,
        radiusInKm: validated.radiusInKm ?? null,
        modelYearMin: validated.modelYearMin ?? null,
        modelYearMax: validated.modelYearMax ?? null,
        mileageMin: validated.mileageMin ?? null,
        mileageMax: validated.mileageMax ?? null,
        priceMin: validated.priceMin ?? null,
        mode: validated.mode,
        priceMax: validated.priceMax ?? null,
        marginMinPercentage: validated.marginMinPercentage ?? null,
        notificationChannels: validated.notificationChannels,
      })
      .where(and(eq(alerts.id, alertId), eq(alerts.accountId, accountId)))
      .returning({ id: alerts.id });

    if (!updated) {
      return { success: false, error: 'Alerte introuvable.' };
    }

    revalidatePath('/alerts');
    revalidatePath(`/alerts/${alertId}/edit`);

    return { success: true, alertId: updated.id };
  } catch {
    return { success: false, error: "Impossible d'enregistrer les modifications. Veuillez réessayer." };
  }
}

export async function updateAlertStatus(alertId: string, status: TAlertStatus) {
  const accountId = await getCurrentUserId();
  const db = getDBAdminClient();

  if (status === EAlertStatus.ACTIVE) {
    const [account] = await db
      .select({ hasSubscription: accounts.hasSubscription })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    if (!account?.hasSubscription) {
      throw new Error('Un abonnement actif est requis pour activer une alerte.');
    }
  }

  const [updated] = await db
    .update(alerts)
    .set({ status })
    .where(and(eq(alerts.id, alertId), eq(alerts.accountId, accountId)))
    .returning({ id: alerts.id, status: alerts.status });

  if (!updated) {
    throw new Error('Alerte introuvable.');
  }

  revalidatePath('/alerts');
  return updated;
}

export async function deleteAlert(alertId: string) {
  const accountId = await getCurrentUserId();
  const db = getDBAdminClient();

  const deleted = await db
    .delete(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.accountId, accountId)))
    .returning({ id: alerts.id });

  if (deleted.length === 0) {
    throw new Error('Alerte introuvable.');
  }

  revalidatePath('/alerts');
  return { success: true };
}
