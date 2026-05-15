import { DataNotFound } from '@/components/fallback/data-not-found';
import { pages } from '@/config/routes';

export default function NotFound() {
  return (
    <DataNotFound
      title="Page introuvable"
      description="La page que tu cherches n'existe pas ou a été déplacée."
      action={{
        label: 'Retour au dashboard',
        href: pages.dashboard,
      }}
    />
  );
}
