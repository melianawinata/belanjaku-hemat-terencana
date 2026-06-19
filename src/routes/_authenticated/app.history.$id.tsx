import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, logActivity } from "@/lib/useAuth";
import { formatRupiah, labelBulanTahun } from "@/lib/format";
import { BelanjaItemRow } from "@/lib/belanja";
import { PageHeader } from "@/components/app-shell";
import { StatCard, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/history/$id")({
  head: () => ({ meta: [{ title: "Detail History — BelanjaKu" }] }),
  component: HistoryDetail,
});

function HistoryDetail() {
  const { id } = Route.useParams();
  const { userId } = useAuth();
  const [editing, setEditing] = useState<BelanjaItemRow | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["history-detail", id],
    queryFn: async () => {
      const { data: belanja } = await supabase.from("belanja_bulanan").select("*").eq("id", id).maybeSingle();
      const { data: items } = await supabase.from("belanja_item").select("*").eq("belanja_id", id).order("created_at");
      const { data: toko } = await supabase.from("toko").select("id, nama");
      return { belanja, items: (items ?? []) as BelanjaItemRow[], toko: toko ?? [] };
    },
  });

  if (isLoading) return (<><PageHeader title="Detail History" /><Skeleton className="h-40" /></>);
  const belanja = data?.belanja;
  const items = data?.items ?? [];
  const tokoMap = new Map((data?.toko ?? []).map((t) => [t.id, t.nama]));
  const total = items.filter((i) => i.sudah_dibeli && i.harga_aktual != null).reduce((s, i) => s + Number(i.harga_aktual), 0);

  return (
    <>
      <PageHeader title={belanja ? labelBulanTahun(belanja.bulan, belanja.tahun) : "Detail History"} subtitle="Rincian item belanja" action={
        <Link to="/app/history"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Button></Link>
      } />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Total Pengeluaran" value={formatRupiah(total)} tone="success" />
          <StatCard label="Budget" value={formatRupiah(Number(belanja?.budget ?? 0))} />
          <StatCard label="Jumlah Item" value={items.length} />
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 border-b bg-muted/40 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:grid">
            <span>Item</span><span>Jumlah</span><span>Toko</span><span className="text-right">Harga</span><span></span>
          </div>
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.id} className="grid grid-cols-[2fr_1fr_auto] items-center gap-2 px-4 py-3 text-sm sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <span className="font-medium">{i.nama_snapshot}</span>
                <span className="font-mono text-xs text-muted-foreground">{i.jumlah} {i.satuan}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">{i.toko_id ? tokoMap.get(i.toko_id) : "-"}</span>
                <span className="hidden text-right font-mono sm:block">{formatRupiah(i.harga_aktual ?? i.estimasi_harga)}</span>
                <Button variant="ghost" size="icon" onClick={() => setEditing(i)}><Pencil className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <EditDialog item={editing} toko={data?.toko ?? []} userId={userId!} onClose={() => setEditing(null)} onSaved={refetch} />
    </>
  );
}

function EditDialog({ item, toko, userId, onClose, onSaved }: {
  item: BelanjaItemRow | null; toko: { id: string; nama: string }[]; userId: string; onClose: () => void; onSaved: () => void;
}) {
  const [harga, setHarga] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [tokoId, setTokoId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setHarga(String(item.harga_aktual ?? item.estimasi_harga ?? 0));
      setJumlah(String(item.jumlah));
      setTokoId(item.toko_id ?? "");
    }
  }, [item]);

  const save = async () => {
    if (!item) return;
    setSaving(true);
    await supabase.from("belanja_item").update({
      harga_aktual: Number(harga), jumlah: Number(jumlah), toko_id: tokoId || null,
    }).eq("id", item.id);
    if (item.item_id) {
      await supabase.from("histori_harga").insert({ item_id: item.item_id, user_id: userId, harga: Number(harga), toko_id: tokoId || null, tanggal: new Date().toISOString() });
    }
    await logActivity(userId, "edit", `Edit history item ${item.nama_snapshot}`);
    setSaving(false);
    toast.success("Perubahan disimpan.");
    setHarga(""); setJumlah("");
    onClose(); onSaved();
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) { setHarga(""); setJumlah(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {item?.nama_snapshot}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Harga</Label><Input type="number" value={harga} onChange={(e) => setHarga(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Jumlah</Label><Input type="number" value={jumlah} onChange={(e) => setJumlah(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Toko</Label>
            <Select value={tokoId} onValueChange={setTokoId}>
              <SelectTrigger><SelectValue placeholder="Pilih toko" /></SelectTrigger>
              <SelectContent>{toko.map((t) => <SelectItem key={t.id} value={t.id}>{t.nama}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
