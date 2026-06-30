import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { useKeluarga } from "@/lib/useKeluarga";
import { formatNumber, formatTanggal } from "@/lib/format";
import {
  getStokList,
  getMutasi,
  catatMutasi,
  tambahStok,
  updateStokMeta,
  hapusBarang,
  stokRendah,
  statusExpired,
  getSatuanTampilanMap,
  keTampilan,
  dariTampilan,
  type StokBarangRow,
  type TipeMutasi,
  type SatuanTampilan,
} from "@/lib/stok";
import { PageHeader } from "@/components/app-shell";
import { KelolaKonversiDialog } from "@/components/satuan-konversi";
import { EmptyState, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Boxes,
  Plus,
  Minus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  MapPin,
  ScrollText,
  Sparkles,
  PackagePlus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/stok")({
  head: () => ({ meta: [{ title: "Stok Barang — BelanjaKu" }] }),
  component: StokPage,
});

// Master item untuk picker (admin-curated). Free-text tetap diperbolehkan.
function useMasterItem() {
  return useQuery({
    queryKey: ["master_item"],
    queryFn: async () => {
      const { data } = await supabase
        .from("item")
        .select("id, nama, kategori_barang_id, satuan_default")
        .order("nama");
      return data ?? [];
    },
  });
}

function StokPage() {
  const { userId } = useAuth();
  const { berlangganan, loading } = useKeluarga();

  const q = useQuery({
    queryKey: ["stok-list", userId],
    enabled: !!userId && berlangganan,
    queryFn: () => getStokList(userId!),
  });
  const tampilanQ = useQuery({
    queryKey: ["satuan-tampilan", userId],
    enabled: !!userId && berlangganan,
    queryFn: () => getSatuanTampilanMap(userId!),
  });

  if (loading) {
    return (
      <>
        <PageHeader title="Stok Barang" subtitle="Kelola persediaan barang belanjaan keluarga." />
        <Skeleton className="h-48" />
      </>
    );
  }

  if (!berlangganan) {
    return (
      <>
        <PageHeader title="Stok Barang" subtitle="Kelola persediaan barang belanjaan keluarga." />
        <div className="mx-auto max-w-md rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <Boxes className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Fitur paket berbayar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lacak persediaan barang di rumah, dapat peringatan stok menipis & mendekati kedaluwarsa.
            Tersedia di paket Plus atau Keluarga.
          </p>
          <Link to="/app/langganan" className="mt-4 inline-block">
            <Button>
              <Sparkles className="mr-2 h-4 w-4" /> Lihat paket
            </Button>
          </Link>
        </div>
      </>
    );
  }

  const refetch = () => q.refetch();
  const stok = q.data ?? [];
  const tampilanMap = tampilanQ.data ?? new Map<string, SatuanTampilan>();
  const rendah = stok.filter(stokRendah).length;

  return (
    <>
      <PageHeader
        title="Stok Barang"
        subtitle="Persediaan barang belanjaan keluarga — masuk dari belanja, berkurang saat dipakai."
        action={<AddStokDialog onChanged={refetch} />}
      />

      {q.isLoading ? (
        <Skeleton className="h-64" />
      ) : stok.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-7 w-7" />}
          title="Belum ada stok"
          desc="Tambahkan barang yang ada di rumah, atau stok akan terisi otomatis saat belanja ditandai sudah dibeli."
          action={<AddStokDialog onChanged={refetch} />}
        />
      ) : (
        <>
          {rendah > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span>
                <strong>{rendah}</strong> barang di bawah stok minimum.
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stok.map((s) => (
              <StokCard
                key={s.id}
                stok={s}
                tampilan={s.item_id ? tampilanMap.get(s.item_id) : undefined}
                onChanged={refetch}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function StokCard({
  stok,
  tampilan,
  onChanged,
}: {
  stok: StokBarangRow;
  tampilan?: SatuanTampilan;
  onChanged: () => void;
}) {
  const { userId } = useAuth();
  const rendah = stokRendah(stok);
  const exp = statusExpired(stok);
  // Tampilkan dalam satuan tampilan bila ada; saldo asli tetap dalam satuan dasar.
  const uSatuan = tampilan?.satuan ?? stok.satuan;
  const uJumlah = keTampilan(Number(stok.jumlah), tampilan);
  const uMin =
    stok.jumlah_minimum != null ? keTampilan(Number(stok.jumlah_minimum), tampilan) : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-semibold">{stok.nama}</p>
          {stok.lokasi && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {stok.lokasi}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {stok.item_id && (
            <KelolaKonversiDialog itemId={stok.item_id} baseSatuan={stok.satuan} nama={stok.nama} />
          )}
          <EditMetaDialog stok={stok} tampilan={tampilan} onChanged={onChanged} />
          <RiwayatDialog stok={stok} />
          <HapusBarang stok={stok} onChanged={onChanged} />
        </div>
      </div>

      <div className="flex flex-1 items-end justify-between gap-2 px-4 py-3">
        <div>
          <p className={`text-2xl font-bold ${rendah ? "text-warning" : ""}`}>
            {formatNumber(uJumlah)}{" "}
            <span className="text-sm font-normal text-muted-foreground">{uSatuan}</span>
          </p>
          {tampilan && (
            <p className="text-xs text-muted-foreground">
              ≈ {formatNumber(stok.jumlah)} {stok.satuan}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {rendah && (
              <Badge variant="outline" className="border-warning/50 text-warning">
                Stok rendah
                {uMin != null ? ` (min ${formatNumber(uMin)} ${uSatuan})` : ""}
              </Badge>
            )}
            {exp === "expired" && <Badge variant="destructive">Kedaluwarsa</Badge>}
            {exp === "soon" && (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                Exp {formatTanggal(stok.tanggal_expired)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <MutasiDialog
            stok={stok}
            tampilan={tampilan}
            tipe="keluar"
            onChanged={onChanged}
            trigger={
              <Button variant="outline" size="icon" title="Catat pemakaian" disabled={!userId}>
                <Minus className="h-4 w-4" />
              </Button>
            }
          />
          <MutasiDialog
            stok={stok}
            tampilan={tampilan}
            tipe="masuk"
            onChanged={onChanged}
            trigger={
              <Button size="icon" title="Tambah stok" disabled={!userId}>
                <Plus className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}

// ---- Dialog: tambah barang baru + stok awal -------------------------------
function AddStokDialog({ onChanged }: { onChanged: () => void }) {
  const { userId } = useAuth();
  const master = useMasterItem();
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [kategoriBarangId, setKategoriBarangId] = useState<string | null>(null);
  const [jumlah, setJumlah] = useState("1");
  const [satuan, setSatuan] = useState("pcs");
  const [lokasi, setLokasi] = useState("");
  const [minimum, setMinimum] = useState("");
  const [expired, setExpired] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setItemId(null);
    setNama("");
    setKategoriBarangId(null);
    setJumlah("1");
    setSatuan("pcs");
    setLokasi("");
    setMinimum("");
    setExpired("");
  };

  const simpan = async () => {
    if (!nama.trim()) {
      toast.error("Isi nama barang.");
      return;
    }
    const jml = Number(jumlah);
    if (!(jml > 0)) {
      toast.error("Jumlah harus lebih dari 0.");
      return;
    }
    setSaving(true);
    try {
      await tambahStok(userId!, {
        item_id: itemId,
        nama: nama.trim(),
        kategori_barang_id: kategoriBarangId,
        tipe: "masuk",
        jumlah: jml,
        satuan,
        lokasi: lokasi.trim() || null,
        jumlah_minimum: minimum.trim() ? Number(minimum) : null,
        tanggal_expired: expired || null,
      });
      reset();
      setOpen(false);
      toast.success("Stok ditambahkan.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menambah stok.");
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
          <PackagePlus className="mr-2 h-4 w-4" /> Tambah Stok
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah stok barang</DialogTitle>
          <DialogDescription>
            Pilih dari daftar item, atau ketik nama barang sendiri.
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
                const m = (master.data ?? []).find((x) => x.id === v);
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
                {(master.data ?? []).map((m) => (
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
              placeholder="mis. Beras, Minyak Goreng"
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
              <Input value={satuan} onChange={(e) => setSatuan(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stok minimum (opsional)</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
                placeholder="mis. 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kedaluwarsa (opsional)</Label>
              <Input type="date" value={expired} onChange={(e) => setExpired(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Lokasi simpan (opsional)</Label>
            <Input
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              placeholder="mis. Kulkas, Lemari dapur"
            />
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

// ---- Dialog: catat masuk / keluar cepat -----------------------------------
function MutasiDialog({
  stok,
  tampilan,
  tipe,
  onChanged,
  trigger,
}: {
  stok: StokBarangRow;
  tampilan?: SatuanTampilan;
  tipe: TipeMutasi;
  onChanged: () => void;
  trigger: React.ReactNode;
}) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [jumlah, setJumlah] = useState("1");
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const masuk = tipe === "masuk";
  const uSatuan = tampilan?.satuan ?? stok.satuan;

  const simpan = async () => {
    const jml = Number(jumlah);
    if (!(jml > 0)) {
      toast.error("Jumlah harus lebih dari 0.");
      return;
    }
    setSaving(true);
    try {
      // Dicatat dalam satuan tampilan; trigger DB menormalkan ke satuan dasar.
      await catatMutasi(userId!, {
        item_id: stok.item_id,
        nama: stok.nama,
        kategori_barang_id: stok.kategori_barang_id,
        tipe,
        jumlah: jml,
        satuan: uSatuan,
        catatan: catatan.trim() || null,
      });
      setJumlah("1");
      setCatatan("");
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mencatat.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {masuk ? "Tambah stok" : "Catat pemakaian"} — {stok.nama}
          </DialogTitle>
          <DialogDescription>
            Saldo saat ini {formatNumber(keTampilan(Number(stok.jumlah), tampilan))} {uSatuan}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Jumlah ({uSatuan})</Label>
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Catatan (opsional)</Label>
            <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={simpan} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {masuk ? "Tambahkan" : "Kurangi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Dialog: edit metadata + koreksi saldo --------------------------------
function EditMetaDialog({
  stok,
  tampilan,
  onChanged,
}: {
  stok: StokBarangRow;
  tampilan?: SatuanTampilan;
  onChanged: () => void;
}) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [satuan, setSatuan] = useState(stok.satuan);
  const [minimum, setMinimum] = useState(
    stok.jumlah_minimum != null ? String(keTampilan(Number(stok.jumlah_minimum), tampilan)) : "",
  );
  const [lokasi, setLokasi] = useState(stok.lokasi ?? "");
  const [expired, setExpired] = useState(stok.tanggal_expired ?? "");
  const [saldoBaru, setSaldoBaru] = useState("");
  const [saving, setSaving] = useState(false);
  const uSatuan = tampilan?.satuan ?? stok.satuan;

  const simpan = async () => {
    setSaving(true);
    try {
      await updateStokMeta(stok.id, {
        satuan,
        // minimum diinput dalam satuan tampilan → simpan sebagai satuan dasar.
        jumlah_minimum: minimum.trim() ? dariTampilan(Number(minimum), tampilan) : null,
        lokasi: lokasi.trim() || null,
        tanggal_expired: expired || null,
      });
      // Koreksi saldo: target (satuan tampilan) → selisih dalam satuan dasar.
      if (saldoBaru.trim()) {
        const targetDasar = dariTampilan(Number(saldoBaru), tampilan);
        const delta = targetDasar - Number(stok.jumlah);
        if (delta !== 0) {
          await catatMutasi(userId!, {
            item_id: stok.item_id,
            nama: stok.nama,
            kategori_barang_id: stok.kategori_barang_id,
            tipe: "koreksi",
            jumlah: delta,
            satuan: stok.satuan,
            catatan: "Koreksi saldo manual",
          });
        }
      }
      setOpen(false);
      toast.success("Tersimpan.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Ubah">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ubah {stok.nama}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Satuan</Label>
              <Input value={satuan} onChange={(e) => setSatuan(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Stok minimum ({uSatuan})</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kedaluwarsa</Label>
              <Input type="date" value={expired} onChange={(e) => setExpired(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Koreksi saldo jadi ({uSatuan})</Label>
              <Input
                type="number"
                step={0.1}
                value={saldoBaru}
                onChange={(e) => setSaldoBaru(e.target.value)}
                placeholder={formatNumber(keTampilan(Number(stok.jumlah), tampilan))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Lokasi simpan</Label>
            <Input value={lokasi} onChange={(e) => setLokasi(e.target.value)} />
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

// ---- Dialog: kartu stok (riwayat mutasi) ----------------------------------
function RiwayatDialog({ stok }: { stok: StokBarangRow }) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["stok-mutasi", stok.item_key],
    enabled: open && !!userId,
    queryFn: () => getMutasi(userId!, stok.item_key),
  });
  const rows = q.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Riwayat">
          <ScrollText className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Riwayat stok — {stok.nama}</DialogTitle>
          <DialogDescription>
            Saldo sekarang {formatNumber(stok.jumlah)} {stok.satuan}.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <Skeleton className="h-32" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada pergerakan.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((m) => {
              const masuk = m.tipe === "masuk" || (m.tipe === "koreksi" && Number(m.jumlah) > 0);
              return (
                <li key={m.id} className="flex items-center gap-2 py-2.5 text-sm">
                  <span
                    className={`font-mono font-semibold ${masuk ? "text-success" : "text-destructive"}`}
                  >
                    {masuk ? "+" : "−"}
                    {formatNumber(Math.abs(Number(m.jumlah)))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate capitalize">
                      {m.tipe}
                      {m.sumber !== "manual" && (
                        <span className="text-muted-foreground"> · dari {m.sumber}</span>
                      )}
                    </p>
                    {m.catatan && (
                      <p className="truncate text-xs text-muted-foreground">{m.catatan}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTanggal(m.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Hapus barang ----------------------------------------------------------
function HapusBarang({ stok, onChanged }: { stok: StokBarangRow; onChanged: () => void }) {
  const { userId } = useAuth();
  const hapus = async () => {
    try {
      await hapusBarang(userId!, stok);
      toast.success("Barang dihapus dari stok.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Hapus">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {stok.nama} dari stok?</AlertDialogTitle>
          <AlertDialogDescription>
            Seluruh riwayat pergerakan barang ini ikut terhapus. Tindakan ini tidak bisa dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={hapus}>Hapus</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
