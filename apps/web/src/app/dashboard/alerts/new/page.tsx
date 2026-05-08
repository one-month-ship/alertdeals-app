import Link from 'next/link';
import { pages } from '@/config/routes';

export default function NewAlertPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Bienvenue sur AlertDeals 👋</h1>
      <p className="mb-6 text-gray-600">
        C'est ta première connexion. On va te faire créer ta première alerte.
      </p>

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
        Le formulaire de création d'alerte arrive bientôt.
      </div>

      <Link
        href={pages.dashboard}
        className="mt-6 inline-block text-sm text-indigo-600 hover:underline"
      >
        ← Aller au dashboard
      </Link>
    </main>
  );
}
