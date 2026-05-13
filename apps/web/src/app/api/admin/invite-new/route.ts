import { apiRoutes } from "@/config/routes";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/utils/get-site-url";

export async function POST(req: Request) {
  // Must be admin user initiating the request
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.ADMIN_API_SECRET;

  if (authHeader !== `Bearer ${expectedToken}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${getSiteUrl()}${apiRoutes.authCallback}?invited=1`,
    },
  );

  return Response.json({ data, error });
}
