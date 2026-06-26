import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShoppingBasket, UserCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lengkapi-profil")({
  ssr: false,
  head: () => ({ meta: [{ title: "Lengkapi Profil — BelanjaKu" }] }),
  // Gerbang: profil yang SUDAH lengkap tidak boleh membuka halaman ini lagi.
  // Ini sekaligus mencegah user "kembali" ke alur daftar setelah selesai.
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("kategori_user_id")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.kategori_user_id) throw redirect({ to: "/app/dashboard" });
    return { user: data.user };
  },
  component: LengkapiProfilPage,
});

function LengkapiProfilPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const { data: kategoriList } = useQuery({
    queryKey: ["kategori_user_public"],
    queryFn: async () => (await supabase.from("kategori_user").select("id, nama").order("nama")).data ?? [],
  });

  // Prefill nama dari profil (sudah diisi trigger dari nama akun Google).
  useEffect(() => {
    let active = true;
    supabase
      .from("profiles")
      .select("nama")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
        setNama(data?.nama || meta.full_name || meta.name || "");
      });
    return () => {
      active = false;
    };
  }, [user]);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!nama.trim()) {
      setErr("Nama tidak boleh kosong.");
      return;
    }
    if (!kategori) {
      setErr("Pilih kategori pengguna dulu ya.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nama: nama.trim(), kategori_user_id: kategori })
      .eq("id", user.id);
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profil lengkap! Yuk lanjut. 🎉");
    navigate({ to: "/onboarding", replace: true });
  };

  // Satu-satunya jalan keluar adalah keluar akun (bukan kembali ke daftar/masuk).
  const keluar = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingBasket className="h-5 w-5" />
          </span>
          <span className="font-mono text-lg font-semibold tracking-tight">BelanjaKu</span>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-extrabold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Lengkapi profil kamu
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tinggal satu langkah lagi sebelum mulai. Lengkapi data berikut ya.
          </p>
          <form onSubmit={simpan} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lp-nama">Nama</Label>
              <Input
                id="lp-nama"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kategori Pengguna</Label>
              <Select value={kategori} onValueChange={setKategori}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {(kategoriList ?? []).map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lanjutkan
            </Button>
          </form>
          <button
            type="button"
            onClick={keluar}
            className="mt-4 block w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Bukan kamu? Keluar
          </button>
        </div>
      </div>
    </div>
  );
}
