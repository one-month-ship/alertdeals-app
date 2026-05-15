import { AlertForm } from '@/components/alerts/alert-form';
import { getUserAccount } from '@/services/account.service';
import { getBrands, getVehicleModels } from '@/services/ad-reference.service';
import { hasActiveSubscription } from '@/services/subscription.service';

export default async function NewAlertPage() {
  const account = await getUserAccount();

  const [brands, vehicleModels, isSubscribed] = await Promise.all([
    getBrands(),
    getVehicleModels(),
    hasActiveSubscription(account.id),
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
