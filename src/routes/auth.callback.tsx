import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { routeAfterAuth, safeInternalPath } from "@/lib/useAuth";
import { Loader2, ShoppingBasket } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  // Hanya render di client: sesi OAuth dibaca dari URL hash + localStorage.
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Masuk… — BelanjaKu" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect: redirectTo } = Route.useSearch();
  const [err, setErr] = useState("");

  useEffect(() => {
    let done = false;

    const go = async (userId: string) => {
      if (done) return;
      done = true;
      const target = await routeAfterAuth(userId);
      // Profil lengkap + ada tujuan asli -> kembali ke sana (mis. checkout).
      const safe = safeInternalPath(redirectTo);
      if (safe && target !== "/lengkapi-profil") {
        router.history.replace(safe);
        return;
      }
      navigate({ to: target, replace: true });
    };

    // Supabase otomatis menukar kode/hash OAuth menjadi sesi (detectSessionInUrl).
    // Tangkap lewat event SIGNED_IN, dengan fallback getSession bila sesi sudah siap.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void go(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) void go(data.session.user.id);
    });

    // Jaring pengaman: bila dalam 8 detik tak ada sesi, kembalikan ke /auth.
    const timer = setTimeout(() => {
      if (!done) {
        setErr("Gagal menyelesaikan login Google. Coba lagi ya.");
        setTimeout(() => navigate({ to: "/auth", replace: true }), 1500);
      }
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate, router, redirectTo]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-bg px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <ShoppingBasket className="h-6 w-6" />
      </span>
      {err ? (
        <p className="text-sm text-destructive">{err}</p>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">Menyiapkan akunmu…</span>
        </div>
      )}
    </div>
  );
}
