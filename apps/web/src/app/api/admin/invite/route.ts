import { pages } from "@/config/routes";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/utils/get-site-url";

export async function POST(req: Request) {
  const { email } = await req.json();

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${getSiteUrl()}${pages.authCallback}`,
    },
  );

  return Response.json({ data, error });
}
