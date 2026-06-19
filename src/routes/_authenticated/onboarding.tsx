import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { bulanIni } from "@/lib/format";
import { getOrCreateBelanja, getEstimasiHarga } from "@/lib/belanja";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, ShoppingBasket, PartyPopper, Wallet, ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { userId, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [budget, setBudget] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: defaults } = useQuery({
    queryKey: ["onboarding_defaults", profile?.kategori_user_id],
    queryFn: async () => {
      if (!profile?.kategori_user_id) return [];
      const { data } = await supabase
        .from("default_item_kategori")
        .select("item:item_id(id, nama, satuan_default)")
        .eq("kategori_user_id", profile.kategori_user_id);
      return (data ?? []).map((d) => d.item).filter(Boolean) as { id: string; nama: string; satuan_default: string }[];
    },
    enabled: !!profile?.kategori_user_id,
  });

  useEffect(() => {
    if (defaults) {
      const init: Record<string, boolean> = {};
      defaults.forEach((d) => { init[d.id] = true; });
      setSelected(init);
    }
  }, [defaults]);

  const finish = async (skipItems: boolean) => {
    if (!userId) return;
    setSaving(true);
    const { bulan, tahun } = bulanIni();
    const belanja = await getOrCreateBelanja(userId, bulan, tahun, Number(budget) || 0);
    if (Number(budget) > 0) {
      await supabase.from("belanja_bulanan").update({ budget: Number(budget) }).eq("id", belanja.id);
    }
    if (!skipItems && defaults) {
      const chosen = defaults.filter((d) => selected[d.id]);
      const rows = await Promise.all(chosen.map(async (d) => ({
        belanja_id: belanja.id,
        user_id: userId,
        item_id: d.id,
        nama_snapshot: d.nama,
        jumlah: 1,
        satuan: d.satuan_default,
        estimasi_harga: await getEstimasiHarga(userId, d.id),
      })));
      if (rows.length > 0) await supabase.from("belanja_item").insert(rows);
    }
    setSaving(false);
    toast.success("Selamat datang di BelanjaKu! 🎉");
    navigate({ to: "/app/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingBasket className="h-5 w-5" />
          </span>
          <span className="font-mono text-lg font-semibold">BelanjaKu</span>
        </div>
        <div className="mb-4 flex justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 w-12 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          {step === 1 && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <PartyPopper className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-extrabold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                Selamat datang, {profile?.nama?.split(" ")[0] || "Sahabat"}!
              </h1>
              <p className="text-sm text-muted-foreground">
                BelanjaKu bantu kamu belanja bulanan lebih hemat, terencana, dan nggak ada yang kelupaan.
                Yuk siapkan budget & daftar belanja pertamamu dalam 2 langkah singkat.
              </p>
              <Button className="w-full" onClick={() => setStep(2)}>Mulai</Button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Wallet className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-extrabold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Atur budget bulan ini</h1>
              <p className="text-sm text-muted-foreground">Berapa anggaran belanja bulananmu? Tenang, bisa diubah kapan saja.</p>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Budget (Rp)</Label>
                <Input id="budget" type="number" inputMode="numeric" value={budget}
                  onChange={(e) => setBudget(e.target.value)} placeholder="Contoh: 1500000" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Kembali</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>Lanjut</Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ListChecks className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-extrabold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Pilih item awal</h1>
              <p className="text-sm text-muted-foreground">Kami sudah centang kebutuhan umum untuk kategorimu. Hilangkan yang tak perlu.</p>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border p-2">
                {(defaults ?? []).map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted">
                    <Checkbox checked={!!selected[d.id]} onCheckedChange={(v) => setSelected((p) => ({ ...p, [d.id]: !!v }))} />
                    <span className="text-sm">{d.nama}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{d.satuan_default}</span>
                  </label>
                ))}
                {(defaults ?? []).length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Belum ada item default untuk kategorimu.</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => finish(true)} disabled={saving}>Lewati</Button>
                <Button className="flex-1" onClick={() => finish(false)} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Selesai
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
