import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { usePeriode } from "@/lib/periode";
import { formatRupiah, formatTanggal, namaBulan } from "@/lib/format";
import {
  getBelanjaTambahan,
  addBelanjaTambahan,
  updateBelanjaTambahan,
  deleteBelanjaTambahan,
  type BelanjaItemRow,
} from "@/lib/belanja";
import { SatuanField } from "@/components/satuan-konversi";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Pencil, ShoppingBag, Boxes } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/belanja-tambahan")({
  head: () => ({ meta: [{ title: "Belanja Tambahan — BelanjaKu" }] }),
  component: BelanjaTambahanPage,
});

function hariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function BelanjaTambahanPage() {
  const { userId } = useAuth();
  const { bulan, tahun } = usePeriode();

  const q = useQuery({
    queryKey: ["belanja-tambahan", userId, bulan, tahun],
    enabled: !!userId,
    queryFn: () => getBelanjaTambahan(userId!, bulan, tahun),
  });
  const items = q.data ?? [];
  const total = items.reduce((s, i) => s + Number(i.harga_aktual ?? 0), 0);
  const refetch = () => q.refetch();

  return (
    <>
      <PageHeader
        title="Belanja Tambahan"
        subtitle={`Pembelian susulan ${namaBulan(bulan)} ${tahun} — langsung masuk stok & terhitung budget.`}
        action={<AddDialog onDone={refetch} />}
      />

      {q.isLoading ? (
        <Skeleton className="h-48" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-7 w-7" />}
          title="Belum ada belanja tambahan"
          desc="Catat pembelian susulan di luar daftar rutin (mis. telur kurang, beli lagi). Stok & budget otomatis menyesuaikan."
          action={<AddDialog onDone={refetch} />}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 shadow-sm">
            <span className="text-sm text-muted-foreground">Total tambahan bulan ini</span>
            <span className="text-lg font-bold">{formatRupiah(total)}</span>
          </div>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
            {items.map((i) => (
              <BarisTambahan key={i.id} item={i} onChanged={refetch} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function BarisTambahan({ item, onChanged }: { item: BelanjaItemRow; onChanged: () => void }) {
  const hapus = async () => {
    try {
      await deleteBelanjaTambahan(item.id);
      toast.success("Pembelian dihapus — stok dikembalikan.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  };
  const belumAdaHarga = item.harga_aktual == null || Number(item.harga_aktual) === 0;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.nama_snapshot}</p>
        <p className="text-xs text-muted-foreground">
          {Number(item.jumlah)} {item.satuan}
          {item.dibeli_at && ` · ${formatTanggal(item.dibeli_at)}`}
        </p>
      </div>
      <span
        className={`shrink-0 text-sm font-semibold ${belumAdaHarga ? "text-muted-foreground italic" : ""}`}
      >
        {belumAdaHarga ? "— harga?" : formatRupiah(Number(item.harga_aktual))}
      </span>
      <EditDialog item={item} onChanged={onChanged} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-destructive" title="Hapus">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {item.nama_snapshot}?</AlertDialogTitle>
            <AlertDialogDescription>
              Pembelian ini akan dihapus dan stok yang tadi masuk dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={hapus}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function EditDialog({ item, onChanged }: { item: BelanjaItemRow; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [jumlah, setJumlah] = useState(String(item.jumlah));
  const [satuan, setSatuan] = useState(item.satuan);
  const [harga, setHarga] = useState(item.harga_aktual != null ? String(item.harga_aktual) : "");
  const [tanggal, setTanggal] = useState(item.dibeli_at ? item.dibeli_at.slice(0, 10) : hariIni());
  const [saving, setSaving] = useState(false);

  const masterQ = useQuery({
    queryKey: ["master_item"],
    queryFn: async () => {
      const { data } = await supabase
        .from("item")
        .select("id, nama, kategori_barang_id, satuan_default")
        .order("nama");
      return data ?? [];
    },
  });
  const baseSatuan = item.item_id
    ? ((masterQ.data ?? []).find((m) => m.id === item.item_id)?.satuan_default ?? null)
    : null;

  const reset = () => {
    setJumlah(String(item.jumlah));
    setSatuan(item.satuan);
    setHarga(item.harga_aktual != null ? String(item.harga_aktual) : "");
    setTanggal(item.dibeli_at ? item.dibeli_at.slice(0, 10) : hariIni());
  };

  const simpan = async () => {
    const jml = Number(jumlah);
    if (!(jml > 0)) {
      toast.error("Jumlah harus lebih dari 0.");
      return;
    }
    const hrg = Number(harga);
    if (!(hrg >= 0)) {
      toast.error("Harga tidak valid.");
      return;
    }
    setSaving(true);
    try {
      await updateBelanjaTambahan(item.id, { jumlah: jml, satuan, harga: hrg, tanggal });
      queryClient.invalidateQueries({ queryKey: ["stok-list"] });
      queryClient.invalidateQueries({ queryKey: ["satuan-tampilan"] });
      queryClient.invalidateQueries({ queryKey: ["belanja"] });
      setOpen(false);
      toast.success("Pembelian diperbarui.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Ubah">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ubah {item.nama_snapshot}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Boxes className="h-3.5 w-3.5" /> Perubahan jumlah/satuan menyesuaikan stok; harga
            memengaruhi budget.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jumlah</Label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Satuan</Label>
              <SatuanField
                itemId={item.item_id}
                baseSatuan={baseSatuan}
                value={satuan}
                onChange={setSatuan}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Harga total (Rp)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={harga}
                onChange={(e) => setHarga(e.target.value)}
                placeholder="mis. 30000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal beli</Label>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={simpan} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({ onDone }: { onDone: () => void }) {
  const { userId } = useAuth();
  const { bulan, tahun } = usePeriode();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [kategoriBarangId, setKategoriBarangId] = useState<string | null>(null);
  const [jumlah, setJumlah] = useState("1");
  const [satuan, setSatuan] = useState("pcs");
  const [harga, setHarga] = useState("");
  const [tanggal, setTanggal] = useState(hariIni());
  const [saving, setSaving] = useState(false);

  const masterQ = useQuery({
    queryKey: ["master_item"],
    queryFn: async () => {
      const { data } = await supabase
        .from("item")
        .select("id, nama, kategori_barang_id, satuan_default")
        .order("nama");
      return data ?? [];
    },
  });
  const baseSatuan = (masterQ.data ?? []).find((m) => m.id === itemId)?.satuan_default ?? null;

  const reset = () => {
    setItemId(null);
    setNama("");
    setKategoriBarangId(null);
    setJumlah("1");
    setSatuan("pcs");
    setHarga("");
    setTanggal(hariIni());
  };

  const simpan = async () => {
    if (!nama.trim()) {
      toast.error("Pilih atau ketik nama barang.");
      return;
    }
    const jml = Number(jumlah);
    if (!(jml > 0)) {
      toast.error("Jumlah harus lebih dari 0.");
      return;
    }
    const hrg = Number(harga);
    if (!(hrg >= 0)) {
      toast.error("Harga tidak valid.");
      return;
    }
    setSaving(true);
    try {
      await addBelanjaTambahan(userId!, bulan, tahun, {
        item_id: itemId,
        nama: nama.trim(),
        kategori_barang_id: kategoriBarangId,
        jumlah: jml,
        satuan,
        harga: hrg,
        tanggal,
      });
      queryClient.invalidateQueries({ queryKey: ["stok-list"] });
      queryClient.invalidateQueries({ queryKey: ["satuan-tampilan"] });
      queryClient.invalidateQueries({ queryKey: ["belanja"] });
      reset();
      setOpen(false);
      toast.success("Belanja tambahan dicatat — stok bertambah.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mencatat.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Tambah Belanja
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catat belanja tambahan</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Boxes className="h-3.5 w-3.5" /> Langsung menambah stok & terhitung budget{" "}
            {namaBulan(bulan)} {tahun}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Pilih item (opsional)</Label>
            <Select
              value={itemId ?? "none"}
              onValueChange={(v) => {
                if (v === "none") {
                  setItemId(null);
                  return;
                }
                const m = (masterQ.data ?? []).find((x) => x.id === v);
                if (m) {
                  setItemId(m.id);
                  setNama(m.nama);
                  setKategoriBarangId(m.kategori_barang_id);
                  setSatuan(m.satuan_default);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih item atau ketik manual" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Ketik manual —</SelectItem>
                {(masterQ.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nama barang</Label>
            <Input
              value={nama}
              onChange={(e) => {
                setNama(e.target.value);
                setItemId(null);
              }}
              placeholder="mis. Telur Ayam"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jumlah</Label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Satuan</Label>
              <SatuanField
                itemId={itemId}
                baseSatuan={baseSatuan}
                value={satuan}
                onChange={setSatuan}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Harga total (Rp)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={harga}
                onChange={(e) => setHarga(e.target.value)}
                placeholder="mis. 30000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal beli</Label>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={simpan} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
