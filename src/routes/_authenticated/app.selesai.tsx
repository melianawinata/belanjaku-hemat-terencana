import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, logActivity } from "@/lib/useAuth";
import { bulanIni, formatRupiah, namaBulan } from "@/lib/format";
import { getOrCreateBelanja, totalRealisasi, BelanjaItemRow } from "@/lib/belanja";
import { PageHeader } from "@/components/app-shell";
import { StatCard, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, PartyPopper, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/selesai")({
  head: () => ({ meta: [{ title: "Selesai Belanja — BelanjaKu" }] }),
  component: SelesaiPage,
});

function SelesaiPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { bulan, tahun } = bulanIni();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["selesai", userId, bulan, tahun],
    enabled: !!userId,
    queryFn: async () => {
      const belanja = await getOrCreateBelanja(userId!, bulan, tahun);
      const { data: items } = await supabase.from("belanja_item").select("*").eq("belanja_id", belanja.id);
      return { belanja, items: (items ?? []) as BelanjaItemRow[] };
    },
  });

  const belanja = data?.belanja;
  const items = data?.items ?? [];
  const budget = Number(belanja?.budget ?? 0);
  const realisasi = totalRealisasi(items);
  const dibeli = items.filter((i) => i.sudah_dibeli);
  const selisih = budget - realisasi;
  const hemat = selisih >= 0;

  const simpan = async () => {
    if (!belanja) return;
    setSaving(true);
    // write histori_harga for purchased items with a real item_id
    const historiRows = dibeli
      .filter((i) => i.item_id && i.harga_aktual != null)
      .map((i) => ({ item_id: i.item_id!, user_id: userId!, harga: Number(i.harga_aktual), toko_id: i.toko_id, tanggal: new Date().toISOString() }));
    if (historiRows.length > 0) await supabase.from("histori_harga").insert(historiRows);
    await supabase.from("belanja_bulanan").update({ status: "selesai", selesai_at: new Date().toISOString() }).eq("id", belanja.id);
    await logActivity(userId!, "selesai", `Selesai belanja ${namaBulan(bulan)} ${tahun} — total ${formatRupiah(realisasi)}`);
    queryClient.invalidateQueries();
    setSaving(false);
    toast.success("Belanja tersimpan! 🎉");
    navigate({ to: "/app/history" });
  };

  if (isLoading) return (<><PageHeader title="Ringkasan Belanja" /><Skeleton className="h-40" /></>);

  return (
    <>
      <PageHeader title="Ringkasan Belanja" subtitle={`${namaBulan(bulan)} ${tahun}`} />
      <div className="mx-auto max-w-xl space-y-5">
        <div className={`flex items-center gap-3 rounded-2xl border p-5 ${hemat ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10"}`}>
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${hemat ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
            {hemat ? <PartyPopper className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </span>
          <div>
            <p className="text-base font-semibold">
              {hemat ? `Mantap, kamu hemat ${formatRupiah(Math.abs(selisih))} bulan ini! 🎉` : `Belanja melebihi budget ${formatRupiah(Math.abs(selisih))}.`}
            </p>
            <p className="text-sm text-muted-foreground">{hemat ? "Terus pertahankan kebiasaan baik ini." : "Coba sesuaikan daftar bulan depan biar lebih hemat."}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Total Item" value={`${dibeli.length}/${items.length}`} />
          <StatCard label="Total Pengeluaran" value={formatRupiah(realisasi)} tone="success" />
          <StatCard label="Budget" value={formatRupiah(budget)} />
          <StatCard label="Selisih" value={formatRupiah(selisih)} tone={hemat ? "success" : "danger"} />
        </div>

        <div className="rounded-2xl border bg-card shadow-sm">
          <p className="border-b px-4 py-3 text-sm font-semibold">Rincian Pembelian</p>
          <ul className="divide-y">
            {dibeli.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{i.nama_snapshot} <span className="font-mono text-xs text-muted-foreground">· {i.jumlah} {i.satuan}</span></span>
                <span className="font-mono">{formatRupiah(i.harga_aktual)}</span>
              </li>
            ))}
            {dibeli.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada item yang dibeli.</li>}
          </ul>
        </div>

        {belanja?.status === "selesai" ? (
          <Link to="/app/history"><Button className="w-full" size="lg">Lihat History</Button></Link>
        ) : (
          <Button className="w-full" size="lg" onClick={simpan} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Belanja
          </Button>
        )}
      </div>
    </>
  );
}
