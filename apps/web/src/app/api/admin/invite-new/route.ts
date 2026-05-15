import { pages } from "@/config/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/utils/get-site-url";
import { accounts, eq, getDBAdminClient } from "@alertdeals/db";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.ADMIN_API_SECRET;

  if (authHeader !== `Bearer ${expectedToken}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${getSiteUrl()}${pages.authConfirm}`,
    },
  );

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // The trigger creates the account row — mark it as confirmed by admin
  const db = getDBAdminClient();
  await db
    .update(accounts)
    .set({ confirmedByAdmin: true })
    .where(eq(accounts.email, email));

  return Response.json({ success: true });
}
