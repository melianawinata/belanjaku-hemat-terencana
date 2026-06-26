import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    // Simpan tujuan asli agar setelah login user dikembalikan ke sini
    // (mis. klik "Pilih Plus" -> checkout) alih-alih selalu ke dashboard.
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }

    // Profil belum lengkap (mis. user baru via Google) wajib menyelesaikan
    // Lengkapi Profil dulu sebelum mengakses halaman lain. Halaman
    // lengkapi-profil sendiri dikecualikan agar tidak terjadi loop redirect.
    if (location.pathname !== "/lengkapi-profil") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("kategori_user_id")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profile?.kategori_user_id) throw redirect({ to: "/lengkapi-profil" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
