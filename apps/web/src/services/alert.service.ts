import { CACHE_TAGS } from '@/lib/cache.config';
import { getCurrentAccountId } from '@/services/account.service';
import { alerts, and, eq, getDBAdminClient } from '@alertdeals/db';
import { EAlertErrorCode } from '@alertdeals/shared';
import { cacheTag } from 'next/cache';

async function getCachedAccountAlerts(accountId: string) {
  'use cache';
  cacheTag(CACHE_TAGS.alertsByAccount(accountId));

  const db = getDBAdminClient();
  return db.query.alerts.findMany({
    where: eq(alerts.accountId, accountId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    with: {
      brand: true,
      vehicleModel: true,
      location: true,
    },
  });
}

export async function getAccountAlerts() {
  const accountId = await getCurrentAccountId();
  return getCachedAccountAlerts(accountId);
}

async function getCachedAlertById(alertId: string, accountId: string) {
  'use cache';
  cacheTag(CACHE_TAGS.alert(alertId), CACHE_TAGS.alertsByAccount(accountId));

  const db = getDBAdminClient();
  const alert = await db.query.alerts.findFirst({
    where: and(eq(alerts.id, alertId), eq(alerts.accountId, accountId)),
    with: {
      brand: true,
      vehicleModel: true,
      location: true,
    },
  });

  if (!alert) throw new Error(EAlertErrorCode.ALERT_NOT_FOUND);
  return alert;
}

export async function getAlertById(alertId: string) {
  const accountId = await getCurrentAccountId();
  return getCachedAlertById(alertId, accountId);
}

export type TAccountAlert = Awaited<ReturnType<typeof getAccountAlerts>>[number];
