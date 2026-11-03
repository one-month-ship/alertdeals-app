import { AlertForm } from '@/components/alerts/alert-form';
import { getUserAccount } from '@/services/account.service';
import { getBrands, getVehicleModels } from '@/services/ad-reference.service';
import { getAlertCreationBlock } from '@/services/trial.service';

export default async function NewAlertPage() {
  const account = await getUserAccount();

  // creationBlock = raison de blocage (essai expiré sans abonnement, ou limite
  // d'alertes de l'essai atteinte) — drives whether the form shows the paywall
  // CTA instead of the alert fields.
  const [brands, vehicleModels, creationBlock] = await Promise.all([
    getBrands(),
    getVehicleModels(),
    getAlertCreationBlock(account.id),
  ]);

  return (
    <div className="px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-white">Créer une alerte</h1>
      <AlertForm
        brands={brands}
        vehicleModels={vehicleModels}
        creationBlock={creationBlock}
      />
    </div>
  );
}
