import { AlertForm } from '@/components/alerts/alert-form';
import { pages } from '@/config/routes';
import { createDrizzleSupabaseClient } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { getAlertById } from '@/services/alert.service';
import {
  accounts,
  brands as brandsTable,
  vehicleModels as vehicleModelsTable,
} from '@alertdeals/db';
import { notFound, redirect } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAlertPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(pages.login);

  const alert = await getAlertById(id).catch(() => null);
  if (!alert) notFound();

  const db = await createDrizzleSupabaseClient();

  const { isSubscribed, brands, vehicleModels } = await db.rls(async (tx) => {
    const [accountRow] = await tx
      .select({ hasSubscription: accounts.hasSubscription })
      .from(accounts)
      .limit(1);
    const [brandsRows, vehicleModelsRows] = await Promise.all([
      tx.select().from(brandsTable),
      tx.select().from(vehicleModelsTable),
    ]);
    return {
      isSubscribed: accountRow?.hasSubscription ?? false,
      brands: brandsRows,
      vehicleModels: vehicleModelsRows,
    };
  });

  return (
    <div className="px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-white">Modifier l'alerte</h1>
      <AlertForm
        brands={brands}
        vehicleModels={vehicleModels}
        isSubscribed={isSubscribed}
        alert={alert}
      />
    </div>
  );
}
