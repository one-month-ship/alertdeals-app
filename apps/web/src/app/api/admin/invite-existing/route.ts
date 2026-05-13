import { apiRoutes } from "@/config/routes";
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

  const account = await db.query.accounts.findFirst({
    where: (table, { eq }) => eq(table.email, email),
  });

  if (!account) return Response.json({ error: "NO_ACCOUNT" }, { status: 401 });

  try {
    await db
      .update(accounts)
      .set({ confirmedByAdmin: true })
      .where(eq(accounts.email, email));
  } catch (error) {
    console.log(error);
    return Response.json({ error: "UPDATE_ERROR" }, { status: 401 });
  }

  // Envoie le magic link
  const { error } = await supabaseAdmin.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getSiteUrl()}${apiRoutes.authCallback}?invited=1`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
