'use server';

import { createClient } from '@/lib/supabase/server';
import { createAlertSchema } from '@/validation-schemas';
import { accounts, alerts, eq, getDBAdminClient } from '@alertdeals/db';
import { revalidatePath } from 'next/cache';

type CreateAlertResult =
  | { success: true; alertId: string }
  | { success: false; error: string };

export async function createAlert(data: unknown): Promise<CreateAlertResult> {
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
