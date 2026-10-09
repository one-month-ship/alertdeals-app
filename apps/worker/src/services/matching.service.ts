import {
  ads,
  and,
  eq,
  getDBAdminClient,
  gte,
  inArray,
  isNull,
  locations,
  ne,
  or,
  lte,
  sql,
  type SQL,
  type TAlert,
  type TAlertBrand,
  type TAlertModel,
  type TLocation,
} from '@alertdeals/db';
import {
  DAMAGED_VEHICLE_STATE_ID,
  DEFAULT_ALERT_SOURCES,
  EAlertMode,
} from '@alertdeals/shared';

// Depuis la PR multi-select, les marques/modèles d'une alerte vivent dans
// des tables de jointure (`alertBrands`, `alertModels`) et non plus en
// colonnes directes sur `alerts`. Le caller doit donc charger ces relations
// avec `db.query.alerts.findMany({ with: { brands: true, models: true } })`.
type AlertWithRelations = TAlert & {
  location: TLocation | null;
  brands: TAlertBrand[];
  models: TAlertModel[];
};

export type TMatchedAdRow = { adId: string; alertId: string };

export async function findMatchedAdIdsForAccount(
  alertsForAccount: AlertWithRelations[],
): Promise<TMatchedAdRow[]> {
  if (alertsForAccount.length === 0) return [];

  const db = getDBAdminClient();
  const results: TMatchedAdRow[] = [];

  for (const alert of alertsForAccount) {
    const conditions: SQL[] = [];

    // Listing platforms the user opted in for this alert
    const alertSources = alert.sources?.length ? alert.sources : DEFAULT_ALERT_SOURCES;
    conditions.push(inArray(ads.source, alertSources));

    // Marques/modèles : l'utilisateur peut en sélectionner plusieurs.
    // Si la liste est vide → pas de contrainte (alerte tous-modèles confondus),
    // sinon `inArray` matche tout ad dont la marque/modèle est dans la sélection.
    const brandIds = alert.brands.map((b) => b.brandId);
    const modelIds = alert.models.map((m) => m.modelId);
    if (brandIds.length > 0) conditions.push(inArray(ads.brandId, brandIds));
    if (modelIds.length > 0) conditions.push(inArray(ads.modelId, modelIds));

    if (alert.modelYearMin != null) conditions.push(gte(ads.modelYear, alert.modelYearMin));
    if (alert.modelYearMax != null) conditions.push(lte(ads.modelYear, alert.modelYearMax));
    if (alert.mileageMin != null) conditions.push(gte(ads.mileage, alert.mileageMin));
    if (alert.mileageMax != null) conditions.push(lte(ads.mileage, alert.mileageMax));
    if (alert.priceMin != null) conditions.push(gte(ads.price, alert.priceMin));

    // Épaves : seules Leboncoin et AutoScout24 renseignent l'état ; les autres
    // sources tombent sur "Non endommagé" par défaut et passent donc le filtre.
    if (alert.excludeDamaged) {
      conditions.push(
        or(ne(ads.vehicleStateId, DAMAGED_VEHICLE_STATE_ID), isNull(ads.vehicleStateId))!,
      );
    }

    // Typologie d'offre (particulier / pro) : null sur l'alerte = les deux.
    // Les annonces dont la source ne renseigne pas le type (ParuVendu) ou
    // dont la valeur n'a pas été reconnue passent le filtre, comme pour l'état.
    if (alert.ownerType != null) {
      conditions.push(
        or(eq(ads.ownerType, alert.ownerType), isNull(ads.ownerType))!,
      );
    }

    if (alert.mode === EAlertMode.PRICE_MAX && alert.priceMax != null) {
      conditions.push(lte(ads.price, alert.priceMax));
    } else if (alert.mode === EAlertMode.MARGIN_MIN && alert.marginMinPercentage != null) {
      // User enters a percentage point value (e.g. 15 for 15%); ad stores a fraction (0.15).
      conditions.push(gte(ads.marginPercentageMin, alert.marginMinPercentage / 100));
    }

    if (alert.location && alert.radiusInKm != null && alert.radiusInKm > 0) {
      const nearbyIds = await getLocationIdsWithinRadius(
        alert.location.lat,
        alert.location.lng,
        alert.radiusInKm,
      );
      if (nearbyIds.length === 0) continue;
      conditions.push(inArray(ads.locationId, nearbyIds));
    }

    if (conditions.length === 0) continue;

    const matchedAds = await db.query.ads.findMany({
      where: and(...conditions),
      columns: { id: true },
    });

    for (const ad of matchedAds) {
      results.push({ adId: ad.id, alertId: alert.id });
    }
  }

  return results;
}

async function getLocationIdsWithinRadius(
  lat: number,
  lng: number,
  radiusInKm: number,
): Promise<number[]> {
  const db = getDBAdminClient();
  const rows = await db.query.locations.findMany({
    where: sql`ST_DWithin(
      ST_MakePoint(${locations.lng}, ${locations.lat})::geography,
      ST_MakePoint(${lng}, ${lat})::geography,
      ${radiusInKm * 1000}
    )`,
    columns: { id: true },
  });
  return rows.map((r) => r.id);
}
