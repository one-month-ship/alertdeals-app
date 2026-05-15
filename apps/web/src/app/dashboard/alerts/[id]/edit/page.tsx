import { AlertForm } from '@/components/alerts/alert-form';
import { getUserAccount } from '@/services/account.service';
import { getAlertById } from '@/services/alert.service';
import { getBrands, getVehicleModels } from '@/services/ad-reference.service';
import { hasActiveSubscription } from '@/services/subscription.service';
import { notFound } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAlertPage({ params }: Props) {
  const { id } = await params;

  const account = await getUserAccount();

  const [alert, brands, vehicleModels, isSubscribed] = await Promise.all([
    getAlertById(id).catch(() => null),
    getBrands(),
    getVehicleModels(),
    hasActiveSubscription(account.id),
  ]);

  if (!alert) notFound();

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
