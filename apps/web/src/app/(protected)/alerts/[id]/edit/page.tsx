import { AlertForm } from '@/components/alerts/alert-form';
import { createClient } from '@/lib/supabase/server';
import { getAlertById } from '@/services/alert.service';
import {
  accounts,
  brands as brandsTable,
  eq,
  getDBAdminClient,
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
  if (!user) redirect('/login');

  const alert = await getAlertById(id).catch(() => null);
  if (!alert) notFound();

  const db = getDBAdminClient();

  const [accountRow] = await db
    .select({ hasSubscription: accounts.hasSubscription })
    .from(accounts)
    .where(eq(accounts.id, user.id))
    .limit(1);
  const isSubscribed = accountRow?.hasSubscription ?? false;

  const [brands, vehicleModels] = await Promise.all([
    db.select().from(brandsTable),
    db.select().from(vehicleModelsTable),
  ]);

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
