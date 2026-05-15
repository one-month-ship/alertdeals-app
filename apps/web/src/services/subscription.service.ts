import { createDrizzleSupabaseClient } from '@/lib/db';
import { accounts, eq } from '@alertdeals/db';

export async function hasActiveSubscription(accountId: string): Promise<boolean> {
  const client = await createDrizzleSupabaseClient();

  const account = await client.rls(async (tx) =>
    tx.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { hasSubscription: true },
    }),
  );

  return account?.hasSubscription ?? false;
}
