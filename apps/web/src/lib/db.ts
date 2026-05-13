import { createClient } from '@/lib/supabase/server';
import { getDBWithTokenClient, type TDBWithTokenClient } from '@alertdeals/db';

/**
 * Creates a Drizzle client that runs queries with the current user's JWT,
 * so Postgres-level RLS policies apply.
 */
export async function createDrizzleSupabaseClient(): Promise<TDBWithTokenClient> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return getDBWithTokenClient(session?.access_token ?? '');
}
