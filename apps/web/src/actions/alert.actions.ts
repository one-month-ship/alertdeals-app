'use server';

import { CACHE_TAGS } from '@/lib/cache.config';
import { createDrizzleSupabaseClient } from '@/lib/db';
import { getCurrentAccountId } from '@/services/account.service';
import { getAccountAlerts } from '@/services/alert.service';
import { alertFormSchema, createAlertSchema } from '@/validation-schemas';
import { accounts, alerts, eq } from '@alertdeals/db';
import {
  EAccountErrorCode,
  EAlertErrorCode,
  EAlertStatus,
  EGeneralErrorCode,
  ESubscriptionErrorCode,
  type TAlertStatus,
} from '@alertdeals/shared';
import { updateTag } from 'next/cache';

export async function createAlert(data: unknown) {
  const accountId = await getCurrentAccountId();

  const parseResult = createAlertSchema.safeParse(data);
  if (!parseResult.success) {
    throw new Error(EGeneralErrorCode.VALIDATION_FAILED);
  }
  const validated = parseResult.data;

  const db = await createDrizzleSupabaseClient();

  const created = await db.rls(async (tx) => {
    const [account] = await tx
      .select({ hasSubscription: accounts.hasSubscription })
      .from(accounts)
      .limit(1);

    if (!account) {
      throw new Error(EAccountErrorCode.ACCOUNT_NOT_FOUND);
    }
    if (!account.hasSubscription) {
      throw new Error(ESubscriptionErrorCode.SUBSCRIPTION_REQUIRED);
    }

    const [row] = await tx
      .insert(alerts)
      .values({
        accountId,
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

    return row;
  });

  if (!created) {
    throw new Error(EAlertErrorCode.ALERT_SAVE_FAILED);
  }

  updateTag(CACHE_TAGS.alertsByAccount(accountId));

  return { id: created.id };
}

export async function fetchAccountAlerts() {
  return getAccountAlerts();
}

export async function updateAlert(alertId: string, data: unknown) {
  const accountId = await getCurrentAccountId();

  const parseResult = alertFormSchema.safeParse(data);
  if (!parseResult.success) {
    throw new Error(EGeneralErrorCode.VALIDATION_FAILED);
  }
  const validated = parseResult.data;

  const db = await createDrizzleSupabaseClient();

  // RLS enforces account ownership via the `using/withCheck: accountId = auth.uid()` policy.
  const [updated] = await db.rls(async (tx) =>
    tx
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
      .where(eq(alerts.id, alertId))
      .returning({ id: alerts.id }),
  );

  if (!updated) {
    throw new Error(EAlertErrorCode.ALERT_NOT_FOUND);
  }

  updateTag(CACHE_TAGS.alertsByAccount(accountId));
  updateTag(CACHE_TAGS.alert(alertId));

  return { id: updated.id };
}

export async function updateAlertStatus(alertId: string, status: TAlertStatus) {
  const accountId = await getCurrentAccountId();
  const db = await createDrizzleSupabaseClient();

  const updated = await db.rls(async (tx) => {
    if (status === EAlertStatus.ACTIVE) {
      const [account] = await tx
        .select({ hasSubscription: accounts.hasSubscription })
        .from(accounts)
        .limit(1);
      if (!account?.hasSubscription) {
        throw new Error(ESubscriptionErrorCode.SUBSCRIPTION_REQUIRED);
      }
    }

    const [row] = await tx
      .update(alerts)
      .set({ status })
      .where(eq(alerts.id, alertId))
      .returning({ id: alerts.id, status: alerts.status });
    return row;
  });

  if (!updated) {
    throw new Error(EAlertErrorCode.ALERT_NOT_FOUND);
  }

  updateTag(CACHE_TAGS.alertsByAccount(accountId));
  updateTag(CACHE_TAGS.alert(alertId));
  return updated;
}

export async function deleteAlert(alertId: string) {
  const accountId = await getCurrentAccountId();
  const db = await createDrizzleSupabaseClient();

  const deleted = await db.rls(async (tx) =>
    tx.delete(alerts).where(eq(alerts.id, alertId)).returning({ id: alerts.id }),
  );

  if (deleted.length === 0) {
    throw new Error(EAlertErrorCode.ALERT_NOT_FOUND);
  }

  updateTag(CACHE_TAGS.alertsByAccount(accountId));
  updateTag(CACHE_TAGS.alert(alertId));
  return { success: true };
}
