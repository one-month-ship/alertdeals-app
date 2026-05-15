import { CACHE_TAGS } from '@/lib/cache.config';
import { getDBAdminClient } from '@alertdeals/db';
import { cacheLife, cacheTag } from 'next/cache';

export async function getBrands() {
  'use cache';
  cacheTag(CACHE_TAGS.brands);
  cacheLife('weeks');

  const db = getDBAdminClient();
  return db.query.brands.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function getVehicleModels() {
  'use cache';
  cacheTag(CACHE_TAGS.vehicleModels);
  cacheLife('weeks');

  const db = getDBAdminClient();
  return db.query.vehicleModels.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}
