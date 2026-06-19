import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { bulanIni, bulanSebelumnya, formatRupiah, namaBulan } from "@/lib/format";
import { getOrCreateBelanja } from "@/lib/belanja";
import { PageHeader } from "@/components/app-shell";
import { StatCard, BudgetBar, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/budget")({
  head: () => ({ meta: [{ title: "Budget Bulanan — BelanjaKu" }] }),
  component: BudgetPage,
});

function BudgetPage() {
  const { userId } = useAuth();
  const { bulan, tahun } = bulanIni();
  const [budgetInput, setBudgetInput] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["budget", userId, bulan, tahun],
    enabled: !!userId,
    queryFn: async () => {
      const belanja = await getOrCreateBelanja(userId!, bulan, tahun);
      const { data: items } = await supabase.from("belanja_item").select("estimasi_harga, jumlah, harga_aktual, sudah_dibeli").eq("belanja_id", belanja.id);
      const estimasi = (items ?? []).reduce((s, i) => s + Number(i.estimasi_harga) * Number(i.jumlah), 0);
      const realisasi = (items ?? []).filter((i) => i.sudah_dibeli && i.harga_aktual != null).reduce((s, i) => s + Number(i.harga_aktual), 0);

      const { data: all } = await supabase.from("belanja_bulanan").select("*").eq("user_id", userId!).order("tahun").order("bulan");
      const chart = [];
      for (const b of all ?? []) {
        const { data: bi } = await supabase.from("belanja_item").select("harga_aktual, sudah_dibeli").eq("belanja_id", b.id);
        const real = (bi ?? []).filter((x) => x.sudah_dibeli && x.harga_aktual != null).reduce((s, x) => s + Number(x.harga_aktual), 0);
        chart.push({ label: namaBulan(b.bulan).slice(0, 3), budget: Number(b.budget), realisasi: real });
      }
      return { belanja, estimasi, realisasi, chart: chart.slice(-6) };
    },
  });

  useEffect(() => { if (data?.belanja) setBudgetInput(String(data.belanja.budget || "")); }, [data?.belanja]);

  const budget = Number(data?.belanja?.budget ?? 0);
  const pemakaian = (data?.realisasi ?? 0) > 0 ? data!.realisasi : data?.estimasi ?? 0;

  const simpan = async () => {
    if (!data?.belanja) return;
    setSaving(true);
    await supabase.from("belanja_bulanan").update({ budget: Number(budgetInput) || 0 }).eq("id", data.belanja.id);
    setSaving(false);
    toast.success("Budget diperbarui.");
    refetch();
  };

  const salinBulanLalu = async () => {
    if (!userId) return;
    const prev = bulanSebelumnya(bulan, tahun);
    const { data: pb } = await supabase.from("belanja_bulanan").select("budget").eq("user_id", userId).eq("bulan", prev.bulan).eq("tahun", prev.tahun).maybeSingle();
    if (!pb) { toast.error("Belum ada budget bulan lalu."); return; }
    setBudgetInput(String(pb.budget));
    toast.success("Budget bulan lalu disalin. Jangan lupa simpan.");
  };

  if (isLoading) return (<><PageHeader title="Budget Bulanan" /><Skeleton className="h-40" /></>);

  return (
    <>
      <PageHeader title="Budget Bulanan" subtitle={`Atur anggaran ${namaBulan(bulan)} ${tahun}`} />
      <div className="space-y-5">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <Label htmlFor="budget">Budget bulan ini (Rp)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input id="budget" type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} className="max-w-xs" placeholder="Contoh: 1500000" />
            <Button onClick={simpan} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan</Button>
            <Button variant="outline" onClick={salinBulanLalu}><Copy className="mr-2 h-4 w-4" /> Salin Bulan Lalu</Button>
          </div>
          <div className="mt-5"><BudgetBar pemakaian={pemakaian} budget={budget} /></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Budget" value={formatRupiah(budget)} />
          <StatCard label="Estimasi" value={formatRupiah(data?.estimasi ?? 0)} tone="info" />
          <StatCard label="Realisasi" value={formatRupiah(data?.realisasi ?? 0)} tone="success" />
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold">Budget vs Realisasi (beberapa bulan)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.chart ?? []}>
              <XAxis dataKey="label" fontSize={12} />
              <YAxis tickFormatter={(v) => `${v / 1000}k`} fontSize={11} width={36} />
              <Tooltip formatter={(v: number) => formatRupiah(v)} />
              <Legend />
              <Bar dataKey="budget" name="Budget" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="realisasi" name="Realisasi" fill="#16A34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
