'use server';

import { getDBAdminClient, ilike, locations, or, TLocation } from '@alertdeals/db';
export async function searchLocations(query: string): Promise<TLocation[]> {
  const db = getDBAdminClient();

  if (!query || query.trim().length < 2) {
    return db.select().from(locations).limit(10);
  }

  const searchTerm = `${query.trim()}%`;
  return db
    .select()
    .from(locations)
    .where(or(ilike(locations.zipcode, searchTerm), ilike(locations.name, searchTerm)))
    .limit(10);
}
