import { pages } from "@/config/routes";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/utils/get-site-url";
import { accounts, eq, getDBAdminClient } from "@alertdeals/db";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.ADMIN_API_SECRET;

  if (authHeader !== `Bearer ${expectedToken}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();

  const db = getDBAdminClient();
  try {
    db.update(accounts)
      .set({ confirmedByAdmin: true })
      .where(eq(accounts.email, email));
  } catch (error) {
    console.log(error);
    return Response.json({ error: "UPDATE_ERROR" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${getSiteUrl()}${pages.authCallback}`,
    },
  );

  return Response.json({ data, error });
}
