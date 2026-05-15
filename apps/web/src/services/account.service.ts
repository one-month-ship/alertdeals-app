import { createDrizzleSupabaseClient } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { EAccountErrorCode, EGeneralErrorCode } from '@alertdeals/shared';

export async function getCurrentAccountId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(EGeneralErrorCode.UNAUTHORIZED);
  return user.id;
}

export async function getUserAccount() {
  const client = await createDrizzleSupabaseClient();
  const account = await client.rls(async (tx) => tx.query.accounts.findFirst());
  if (!account) throw new Error(EAccountErrorCode.ACCOUNT_NOT_FOUND);
  return account;
}
