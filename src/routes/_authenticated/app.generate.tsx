import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { bulanSebelumnya, namaBulan } from "@/lib/format";
import { usePeriode } from "@/lib/periode";
import { getOrCreateBelanja, getEstimasiHarga } from "@/lib/belanja";
import { getKeluargaId } from "@/lib/keluarga";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, CalendarClock, LayoutTemplate, ArrowLeft } from "lucide-react";

type Mode = "bulan-lalu" | "template";

export const Route = createFileRoute("/_authenticated/app/generate")({
  validateSearch: (s: Record<string, unknown>): { mode: Mode } => ({
    mode: s.mode === "template" ? "template" : "bulan-lalu",
  }),
  head: () => ({ meta: [{ title: "Generate Daftar — BelanjaKu" }] }),
  component: GeneratePage,
});

interface Row { item_id: string | null; nama: string; merk: string | null; kategori_barang_id: string | null; jumlah: number; satuan: string; checked: boolean }

function GeneratePage() {
  const { mode } = Route.useSearch();
  const { userId, profile } = useAuth();
  const navigate = useNavigate();
  const { bulan, tahun } = usePeriode();
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["generate", mode, userId, profile?.kategori_user_id],
    enabled: !!userId,
    queryFn: async () => {
      if (mode === "bulan-lalu") {
        const prev = bulanSebelumnya(bulan, tahun);
        const keluargaId = await getKeluargaId(userId!);
        const { data: pb } = await supabase.from("belanja_bulanan").select("id")
          .eq("keluarga_id", keluargaId).eq("bulan", prev.bulan).eq("tahun", prev.tahun).maybeSingle();
        if (!pb) return [] as Row[];
        const { data: items } = await supabase.from("belanja_item")
          .select("item_id, nama_snapshot, merk, kategori_barang_id, jumlah, satuan").eq("belanja_id", pb.id);
        return (items ?? []).map((i) => ({
          item_id: i.item_id, nama: i.nama_snapshot, merk: i.merk, kategori_barang_id: i.kategori_barang_id,
          jumlah: Number(i.jumlah), satuan: i.satuan, checked: true,
        })) as Row[];
      } else {
        if (!profile?.kategori_user_id) return [] as Row[];
        const { data: defs } = await supabase.from("default_item_kategori")
          .select("item:item_id(id, nama, kategori_barang_id, satuan_default)").eq("kategori_user_id", profile.kategori_user_id);
        return (defs ?? []).map((d) => d.item).filter(Boolean).map((it) => {
          const item = it as { id: string; nama: string; kategori_barang_id: string | null; satuan_default: string };
          return { item_id: item.id, nama: item.nama, merk: null, kategori_barang_id: item.kategori_barang_id, jumlah: 1, satuan: item.satuan_default, checked: true };
        }) as Row[];
      }
    },
  });

  useEffect(() => { if (data) setRows(data); }, [data]);

  const toggleAll = (v: boolean) => setRows((p) => p.map((r) => ({ ...r, checked: v })));
  const allChecked = rows.length > 0 && rows.every((r) => r.checked);

  const tambah = async () => {
    if (!userId) return;
    const chosen = rows.filter((r) => r.checked);
    if (chosen.length === 0) { toast.error("Pilih minimal satu item."); return; }
    setSaving(true);
    const belanja = await getOrCreateBelanja(userId, bulan, tahun);
    const { data: existing } = await supabase.from("belanja_item").select("id, item_id, nama_snapshot, merk, jumlah").eq("belanja_id", belanja.id);
    // Key by item + brand so the same item with a different merk stays a separate row.
    const keyOf = (itemId: string | null, nama: string, merk: string | null) => `${itemId ?? nama}__${merk ?? ""}`;
    const existMap = new Map((existing ?? []).map((e) => [keyOf(e.item_id, e.nama_snapshot, e.merk), e]));

    for (const r of chosen) {
      const found = existMap.get(keyOf(r.item_id, r.nama, r.merk));
      if (found) {
        await supabase.from("belanja_item").update({ jumlah: Number(found.jumlah) + r.jumlah }).eq("id", found.id);
      } else {
        const estimasi = await getEstimasiHarga(userId, r.item_id, r.merk);
        await supabase.from("belanja_item").insert({
          belanja_id: belanja.id, user_id: userId, item_id: r.item_id, nama_snapshot: r.nama, merk: r.merk,
          kategori_barang_id: r.kategori_barang_id, jumlah: r.jumlah, satuan: r.satuan, estimasi_harga: estimasi,
        });
      }
    }
    setSaving(false);
    toast.success(`${chosen.length} item ditambahkan ke daftar.`);
    navigate({ to: "/app/belanja" });
  };

  const title = mode === "bulan-lalu" ? "Ambil dari Bulan Lalu" : "Template Kategori";
  const Icon = mode === "bulan-lalu" ? CalendarClock : LayoutTemplate;

  return (
    <>
      <PageHeader title={title} subtitle="Centang item yang ingin ditambahkan ke daftar belanja" action={
        <Link to="/app/belanja"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Button></Link>
      } />
      {isLoading ? (
        <div className="space-y-2">{[0,1,2,3].map(i=><Skeleton key={i} className="h-12" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Icon className="h-7 w-7" />}
          title={mode === "bulan-lalu" ? "Belum ada belanja bulan lalu" : "Belum ada template kategori"}
          desc={mode === "bulan-lalu"
            ? `Belum ada daftar belanja untuk ${namaBulan(bulanSebelumnya(bulan, tahun).bulan)}. Susun manual dulu yuk.`
            : "Admin belum mengatur item default untuk kategorimu."}
          action={<Link to="/app/belanja"><Button>Kembali ke Daftar</Button></Link>} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAll(!!v)} /> Pilih semua
            </label>
            <span className="font-mono text-xs text-muted-foreground">{rows.filter((r) => r.checked).length}/{rows.length} dipilih</span>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <ul className="divide-y">
              {rows.map((r, idx) => (
                <li key={idx} className="flex items-center gap-3 px-4 py-3">
                  <Checkbox checked={r.checked} onCheckedChange={(v) => setRows((p) => p.map((x, i) => i === idx ? { ...x, checked: !!v } : x))} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {r.nama}
                    {r.merk && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">{r.merk}</span>}
                  </span>
                  <Input type="number" min={0.1} step={0.1} value={r.jumlah} className="h-8 w-16 text-center"
                    onChange={(e) => setRows((p) => p.map((x, i) => i === idx ? { ...x, jumlah: Number(e.target.value) } : x))} />
                  <Input value={r.satuan} className="h-8 w-16 text-center"
                    onChange={(e) => setRows((p) => p.map((x, i) => i === idx ? { ...x, satuan: e.target.value } : x))} />
                </li>
              ))}
            </ul>
          </div>
          <div className="sticky bottom-20 lg:bottom-4">
            <Button className="w-full" size="lg" onClick={tambah} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Tambahkan ke Daftar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
