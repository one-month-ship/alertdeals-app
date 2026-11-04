import type { TAlertBrand, TVehicleModel } from '@alertdeals/db';

// Fichier séparé de matching.service.ts et aux imports type-only : il reste
// importable par les tests unitaires sans évaluer `@alertdeals/db` (dont le
// client postgres exige SUPABASE_DATABASE_URL dès l'import du module).

/**
 * Sémantique PAR MARQUE de la sélection marques/modèles d'une alerte :
 * cocher un modèle ne restreint que sa propre marque ; une marque cochée
 * sans aucun de ses modèles coché vaut « tous les modèles de cette marque ».
 * Renvoie les modèles explicitement cochés et les marques cochées sans
 * restriction de modèle — un ad matche s'il tombe dans l'un OU l'autre.
 *
 * (L'ancien comportement combinait `brandIds` et `modelIds` en AND global :
 * dès qu'un modèle était coché, toute marque cochée sans modèle coché était
 * silencieusement morte — un compte « toutes les Toyota + quelques
 * utilitaires d'autres marques » ne recevait jamais de Toyota.)
 */
export function splitBrandModelSelection(
  brands: Pick<TAlertBrand, 'brandId'>[],
  models: { modelId: number; vehicleModel: Pick<TVehicleModel, 'brandId'> }[],
): { modelIds: number[]; unrestrictedBrandIds: number[] } {
  const modelIds = models.map((m) => m.modelId);
  const brandIdsWithSelectedModels = new Set(models.map((m) => m.vehicleModel.brandId));
  const unrestrictedBrandIds = brands
    .map((b) => b.brandId)
    .filter((id) => !brandIdsWithSelectedModels.has(id));
  return { modelIds, unrestrictedBrandIds };
}
