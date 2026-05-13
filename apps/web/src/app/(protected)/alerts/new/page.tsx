import { AlertForm } from '@/components/alerts/alert-form';
import { pages } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';
import {
  accounts,
  brands as brandsTable,
  eq,
  getDBAdminClient,
  vehicleModels as vehicleModelsTable,
} from '@alertdeals/db';
import { redirect } from 'next/navigation';

export default async function NewAlertPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(pages.login);

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
      <h1 className="mb-6 text-2xl font-semibold text-white">Créer une alerte</h1>
      <AlertForm
        brands={brands}
        vehicleModels={vehicleModels}
        isSubscribed={isSubscribed}
      />
    </div>
  );
}
