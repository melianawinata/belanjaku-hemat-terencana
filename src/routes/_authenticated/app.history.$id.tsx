import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, logActivity } from "@/lib/useAuth";
import { formatRupiah, formatTanggal, labelBulanTahun } from "@/lib/format";
import { BelanjaItemRow } from "@/lib/belanja";
import { getKategoriPengeluaran, getPengeluaranLain, totalPengeluaran } from "@/lib/pengeluaran";
import { PageHeader } from "@/components/app-shell";
import { StatCard, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Loader2, CheckCircle2, Circle } from "lucide-react";

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
      const { data: belanja } = await supabase
        .from("belanja_bulanan")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      const { data: items } = await supabase
        .from("belanja_item")
        .select("*")
        .eq("belanja_id", id)
        .order("created_at");
      const { data: toko } = await supabase.from("toko").select("id, nama");
      const pengeluaranLain = belanja
        ? await getPengeluaranLain(belanja.user_id, belanja.bulan, belanja.tahun)
        : [];
      const kategori = pengeluaranLain.length > 0 ? await getKategoriPengeluaran() : [];
      return {
        belanja,
        items: (items ?? []) as BelanjaItemRow[],
        toko: toko ?? [],
        pengeluaranLain,
        kategori,
      };
    },
  });

  if (isLoading)
    return (
      <>
        <PageHeader title="Detail History" />
        <Skeleton className="h-40" />
      </>
    );
  const belanja = data?.belanja;
  const items = data?.items ?? [];
  const tokoMap = new Map((data?.toko ?? []).map((t) => [t.id, t.nama]));
  const total = items
    .filter((i) => i.sudah_dibeli && i.harga_aktual != null)
    .reduce((s, i) => s + Number(i.harga_aktual), 0);
  const dibeli = items.filter((i) => i.sudah_dibeli).length;
  const pengeluaranLain = data?.pengeluaranLain ?? [];
  const totalLain = totalPengeluaran(pengeluaranLain);
  const katPengeluaran = new Map((data?.kategori ?? []).map((k) => [k.id, k.nama]));
  // Tampilkan item yang sudah dibeli di atas, sisanya mengikuti urutan asli (created_at).
  const sortedItems = [...items].sort((a, b) => Number(b.sudah_dibeli) - Number(a.sudah_dibeli));

  return (
    <>
      <PageHeader
        title={belanja ? labelBulanTahun(belanja.bulan, belanja.tahun) : "Detail History"}
        subtitle="Rincian item belanja"
        action={
          <Link to="/app/history">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
          </Link>
        }
      />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Total Belanja" value={formatRupiah(total)} tone="success" />
          <StatCard label="Budget" value={formatRupiah(Number(belanja?.budget ?? 0))} />
          <StatCard label="Item Dibeli" value={`${dibeli}/${items.length}`} />
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 border-b bg-muted/40 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:grid">
            <span>Item</span>
            <span>Jumlah</span>
            <span>Toko</span>
            <span className="text-right">Harga</span>
            <span></span>
          </div>
          <ul className="divide-y">
            {sortedItems.map((i) => (
              <li
                key={i.id}
                className={`grid grid-cols-[2fr_1fr_auto] items-center gap-2 px-4 py-3 text-sm sm:grid-cols-[2fr_1fr_1fr_1fr_auto] ${i.sudah_dibeli ? "" : "bg-muted/20"}`}
              >
                <span className="flex items-center gap-2 font-medium">
                  {i.sudah_dibeli ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className={i.sudah_dibeli ? "" : "text-muted-foreground"}>
                    {i.nama_snapshot}
                    {i.merk && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({i.merk})
                      </span>
                    )}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {i.jumlah} {i.satuan}
                </span>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {i.toko_id ? tokoMap.get(i.toko_id) : "-"}
                </span>
                <span className="hidden text-right font-mono sm:block">
                  {i.sudah_dibeli ? (
                    formatRupiah(i.harga_aktual ?? 0)
                  ) : (
                    <span className="text-muted-foreground">
                      est. {formatRupiah(i.estimasi_harga)}
                    </span>
                  )}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setEditing(i)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        {pengeluaranLain.length > 0 && (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Pengeluaran Lain
              </span>
              <span className="font-mono text-xs font-semibold text-muted-foreground">
                {formatRupiah(totalLain)}
              </span>
            </div>
            <ul className="divide-y">
              {pengeluaranLain.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {katPengeluaran.get(p.kategori_pengeluaran_id ?? "") ?? "Tanpa kategori"}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatTanggal(p.tanggal)}
                      </span>
                      {p.metode_bayar && (
                        <span className="rounded bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">
                          {p.metode_bayar}
                        </span>
                      )}
                    </div>
                    {p.deskripsi && <p className="mt-0.5 truncate">{p.deskripsi}</p>}
                  </div>
                  <span className="shrink-0 font-mono font-semibold">
                    {formatRupiah(p.nominal)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <EditDialog
        item={editing}
        toko={data?.toko ?? []}
        userId={userId!}
        onClose={() => setEditing(null)}
        onSaved={refetch}
      />
    </>
  );
}

function EditDialog({
  item,
  toko,
  userId,
  onClose,
  onSaved,
}: {
  item: BelanjaItemRow | null;
  toko: { id: string; nama: string }[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
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
    await supabase
      .from("belanja_item")
      .update({
        harga_aktual: Number(harga),
        jumlah: Number(jumlah),
        toko_id: tokoId || null,
      })
      .eq("id", item.id);
    if (item.item_id) {
      // harga = total per baris → histori disimpan per-satuan (÷ jumlah).
      await supabase.from("histori_harga").insert({
        item_id: item.item_id,
        user_id: userId,
        harga: Math.round(Number(harga) / (Number(jumlah) || 1)),
        merk: item.merk,
        toko_id: tokoId || null,
        tanggal: new Date().toISOString(),
      });
    }
    await logActivity(userId, "edit", `Edit history item ${item.nama_snapshot}`);
    setSaving(false);
    toast.success("Perubahan disimpan.");
    setHarga("");
    setJumlah("");
    onClose();
    onSaved();
  };

  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => {
        if (!o) {
          setHarga("");
          setJumlah("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {item?.nama_snapshot}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Harga total</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={harga}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setHarga(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jumlah</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={jumlah}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setJumlah(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Toko</Label>
            <Select value={tokoId} onValueChange={setTokoId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih toko" />
              </SelectTrigger>
              <SelectContent>
                {toko.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">
            Batal
          </Button>
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
