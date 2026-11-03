import { AlertForm } from '@/components/alerts/alert-form';
import { getAlertById } from '@/services/alert.service';
import { getBrands, getVehicleModels } from '@/services/ad-reference.service';
import { notFound } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAlertPage({ params }: Props) {
  const { id } = await params;

  // Pas de gate ici : l'encart de blocage (paywall / limite d'essai) ne
  // concerne que la création — en édition, AlertForm l'ignore de toute façon.
  const [alert, brands, vehicleModels] = await Promise.all([
    getAlertById(id).catch(() => null),
    getBrands(),
    getVehicleModels(),
  ]);

  if (!alert) notFound();

  return (
    <div className="px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-white">Modifier l'alerte</h1>
      <AlertForm
        brands={brands}
        vehicleModels={vehicleModels}
        alert={alert}
      />
    </div>
  );
}
