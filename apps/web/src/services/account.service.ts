import { createClient } from '@/lib/supabase/server';
import { EGeneralErrorCode } from '@alertdeals/shared';

export async function getCurrentAccountId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(EGeneralErrorCode.UNAUTHORIZED);
  return user.id;
}
