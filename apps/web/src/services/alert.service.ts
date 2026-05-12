import { createClient } from '@/lib/supabase/server';
import { alerts, and, eq, getDBAdminClient } from '@alertdeals/db';

async function getCurrentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Vous devez être connecté.');
  return user.id;
}

export async function getAccountAlerts() {
  const accountId = await getCurrentUserId();
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

export async function getAlertById(alertId: string) {
  const accountId = await getCurrentUserId();
  const db = getDBAdminClient();

  const alert = await db.query.alerts.findFirst({
    where: and(eq(alerts.id, alertId), eq(alerts.accountId, accountId)),
    with: {
      brand: true,
      vehicleModel: true,
      location: true,
    },
  });

  if (!alert) throw new Error('Alerte introuvable.');
  return alert;
}

export type TAccountAlert = Awaited<ReturnType<typeof getAccountAlerts>>[number];
