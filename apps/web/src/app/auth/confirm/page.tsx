"use client";

import { pages } from "@/config/routes";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Client-side page that captures the hash fragment from Supabase
 * implicit flow redirects (magic links sent by admin).
 *
 * Supabase setSession validates the JWT server-side before accepting it.
 */
export default function AuthConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (!hash) {
      router.replace(pages.login);
      return;
    }

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      router.replace(pages.login);
      return;
    }

    async function confirm() {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken!,
        refresh_token: refreshToken!,
      });

      if (error) {
        router.replace(
          `${pages.login}?error=${encodeURIComponent("La connexion a échoué. Réessaie ou contacte-nous si le problème persiste.")}`,
        );
        return;
      }
      router.replace(pages.hotDeals);
    }

    confirm();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Connexion en cours...</p>
    </div>
  );
}
