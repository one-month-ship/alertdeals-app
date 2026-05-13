'use server';

import { createDrizzleSupabaseClient } from '@/lib/db';
import { ilike, locations, or, type TLocation } from '@alertdeals/db';

export async function searchLocations(query: string): Promise<TLocation[]> {
  const db = await createDrizzleSupabaseClient();

  return db.rls(async (tx) => {
    if (!query || query.trim().length < 2) {
      return tx.select().from(locations).limit(10);
    }

    const searchTerm = `${query.trim()}%`;
    return tx
      .select()
      .from(locations)
      .where(or(ilike(locations.zipcode, searchTerm), ilike(locations.name, searchTerm)))
      .limit(10);
  });
}
