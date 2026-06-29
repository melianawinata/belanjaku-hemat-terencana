import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { usePeriode } from "@/lib/periode";
import { useKeluarga } from "@/lib/useKeluarga";
import { formatRupiah, namaBulan } from "@/lib/format";
import { getKategoriPengeluaran } from "@/lib/pengeluaran";
import {
  SLOTS,
  NAMA_HARI,
  awalMinggu,
  tambahHari,
  toISODate,
  getMenuList,
  getKomponen,
  getRencana,
  createMenu,
  deleteMenu,
  addKomponen,
  deleteKomponen,
  addRencana,
  deleteRencana,
  generateDariMenu,
  type SlotMakan,
  type TipeKomponen,
  type MenuKomponenRow,
} from "@/lib/menu";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  ShoppingCart,
  Loader2,
  Sparkles,
  X,
  Receipt,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/menu")({
  head: () => ({ meta: [{ title: "Menu Makan — BelanjaKu" }] }),
  component: MenuPage,
});

function MenuPage() {
  const { berlangganan, loading } = useKeluarga();

  if (loading) {
    return (
      <>
        <PageHeader title="Menu Makan" subtitle="Rencanakan menu harian & ubah jadi belanja." />
        <Skeleton className="h-48" />
      </>
    );
  }

  if (!berlangganan) {
    return (
      <>
        <PageHeader title="Menu Makan" subtitle="Rencanakan menu harian & ubah jadi belanja." />
        <div className="mx-auto max-w-md rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <UtensilsCrossed className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Fitur paket berbayar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Perencanaan menu makan mingguan dan otomatis jadi daftar belanja tersedia di paket Plus
            atau Keluarga.
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

  return (
    <>
      <PageHeader
        title="Menu Makan"
        subtitle="Rencanakan menu harian (pagi/siang/sore) dan ubah jadi belanja & pengeluaran."
      />
      <Tabs defaultValue="rencana">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="rencana">Rencana Mingguan</TabsTrigger>
          <TabsTrigger value="resep">Resep / Menu</TabsTrigger>
        </TabsList>
        <TabsContent value="rencana" className="mt-5">
          <RencanaTab />
        </TabsContent>
        <TabsContent value="resep" className="mt-5">
          <ResepTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ============ TAB RENCANA MINGGUAN ============
function RencanaTab() {
  const { userId } = useAuth();
  const { bulan, tahun } = usePeriode();
  const [anchor, setAnchor] = useState<Date>(() => awalMinggu(new Date()));
  const [generating, setGenerating] = useState(false);

  const hari = useMemo(() => Array.from({ length: 7 }, (_, i) => tambahHari(anchor, i)), [anchor]);
  const startISO = toISODate(hari[0]);
  const endISO = toISODate(hari[6]);

  const menusQ = useQuery({
    queryKey: ["menu-list", userId],
    enabled: !!userId,
    queryFn: () => getMenuList(userId!),
  });
  const rencanaQ = useQuery({
    queryKey: ["rencana", userId, startISO, endISO],
    enabled: !!userId,
    queryFn: () => getRencana(userId!, startISO, endISO),
  });

  const menus = menusQ.data ?? [];
  const menuNama = new Map(menus.map((m) => [m.id, m.nama]));
  const rencana = rencanaQ.data ?? [];

  // index: `${tanggalISO}|${slot}` -> rencana[]
  const cellMap = new Map<string, typeof rencana>();
  for (const r of rencana) {
    const key = `${r.tanggal}|${r.slot}`;
    if (!cellMap.has(key)) cellMap.set(key, []);
    cellMap.get(key)!.push(r);
  }

  const refetch = () => rencanaQ.refetch();

  const hapus = async (id: string) => {
    await deleteRencana(id);
    refetch();
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await generateDariMenu(userId!, startISO, endISO, bulan, tahun);
      if (r.belanja === 0 && r.pengeluaran === 0) {
        toast.info(
          r.dilewati > 0
            ? "Semua rencana minggu ini sudah pernah dibelanjakan."
            : "Belum ada menu pada minggu ini.",
        );
      } else {
        toast.success(
          `${r.belanja} item ke belanja ${namaBulan(bulan)} & ${r.pengeluaran} pengeluaran lain dibuat.`,
        );
      }
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat belanja.");
    } finally {
      setGenerating(false);
    }
  };

  const labelMinggu = `${hari[0].getDate()} ${namaBulan(hari[0].getMonth() + 1).slice(0, 3)} – ${hari[6].getDate()} ${namaBulan(hari[6].getMonth() + 1).slice(0, 3)}`;

  if (menusQ.isLoading || rencanaQ.isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      {/* Navigasi minggu + generate */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor(tambahHari(anchor, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-semibold">{labelMinggu}</span>
          <Button variant="outline" size="icon" onClick={() => setAnchor(tambahHari(anchor, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(awalMinggu(new Date()))}>
            Minggu ini
          </Button>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={generating || rencana.length === 0}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-2 h-4 w-4" />
              )}
              Buat belanja & pengeluaran
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ubah rencana minggu ini jadi belanja?</AlertDialogTitle>
              <AlertDialogDescription>
                Bahan masakan akan ditambahkan ke daftar belanja{" "}
                <strong>
                  {namaBulan(bulan)} {tahun}
                </strong>{" "}
                (digabung dengan item yang sudah ada), dan komponen beli-jadi dicatat ke Pengeluaran
                Lain. Rencana yang sudah pernah diproses akan dilewati.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={generate}>Ya, Buat</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {menus.length === 0 && (
        <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
          Belum ada menu. Buat dulu di tab <strong>Resep / Menu</strong> agar bisa dijadwalkan.
        </div>
      )}

      {/* Grid 7 hari × 3 slot (stack di mobile, kolom di desktop) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
        {hari.map((d, idx) => {
          const tISO = toISODate(d);
          const isToday = tISO === toISODate(new Date());
          return (
            <div
              key={tISO}
              className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${isToday ? "ring-2 ring-primary/40" : ""}`}
            >
              <div className="border-b bg-muted/40 px-3 py-2 text-center">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {NAMA_HARI[idx]}
                </p>
                <p className="text-sm font-semibold">{d.getDate()}</p>
              </div>
              <div className="divide-y">
                {SLOTS.map((s) => {
                  const list = cellMap.get(`${tISO}|${s.key}`) ?? [];
                  return (
                    <div key={s.key} className="p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {s.label}
                        </span>
                        <AddRencanaButton
                          tanggal={tISO}
                          slot={s.key}
                          menus={menus}
                          onAdded={refetch}
                        />
                      </div>
                      <ul className="space-y-1">
                        {list.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center gap-1 rounded-lg bg-muted/50 px-2 py-1 text-xs"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {menuNama.get(r.menu_id) ?? "Menu"}
                              {Number(r.porsi) !== 1 && (
                                <span className="text-muted-foreground"> ×{r.porsi}</span>
                              )}
                            </span>
                            {r.dibelanjakan_at && (
                              <ShoppingCart className="h-3 w-3 shrink-0 text-success" />
                            )}
                            <button
                              onClick={() => hapus(r.id)}
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              aria-label="Hapus"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddRencanaButton({
  tanggal,
  slot,
  menus,
  onAdded,
}: {
  tanggal: string;
  slot: SlotMakan;
  menus: { id: string; nama: string }[];
  onAdded: () => void;
}) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [menuId, setMenuId] = useState("");
  const [porsi, setPorsi] = useState("1");
  const [saving, setSaving] = useState(false);

  const simpan = async () => {
    if (!menuId) {
      toast.error("Pilih menu dulu.");
      return;
    }
    setSaving(true);
    try {
      await addRencana(userId!, tanggal, slot, menuId, Number(porsi) || 1);
      setMenuId("");
      setPorsi("1");
      setOpen(false);
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menambah.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-muted-foreground hover:text-primary"
          aria-label="Tambah menu"
          disabled={menus.length === 0}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah menu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Menu</Label>
            <Select value={menuId} onValueChange={setMenuId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih menu" />
              </SelectTrigger>
              <SelectContent>
                {menus.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Porsi</Label>
            <Input type="number" min={1} value={porsi} onChange={(e) => setPorsi(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={simpan} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Tambahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ TAB RESEP / MENU ============
function ResepTab() {
  const { userId } = useAuth();
  const [namaBaru, setNamaBaru] = useState("");
  const [saving, setSaving] = useState(false);

  const menusQ = useQuery({
    queryKey: ["menu-list", userId],
    enabled: !!userId,
    queryFn: () => getMenuList(userId!),
  });
  const menus = menusQ.data ?? [];

  const komponenQ = useQuery({
    queryKey: ["menu-komponen", userId, menus.map((m) => m.id).join(",")],
    enabled: !!userId && menus.length > 0,
    queryFn: () => getKomponen(menus.map((m) => m.id)),
  });
  const kompByMenu = new Map<string, MenuKomponenRow[]>();
  for (const k of komponenQ.data ?? []) {
    if (!kompByMenu.has(k.menu_id)) kompByMenu.set(k.menu_id, []);
    kompByMenu.get(k.menu_id)!.push(k);
  }

  const refetchAll = () => {
    menusQ.refetch();
    komponenQ.refetch();
  };

  const buat = async () => {
    if (!namaBaru.trim()) {
      toast.error("Isi nama menu.");
      return;
    }
    setSaving(true);
    try {
      await createMenu(userId!, namaBaru.trim());
      setNamaBaru("");
      toast.success("Menu dibuat.");
      menusQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat menu.");
    } finally {
      setSaving(false);
    }
  };

  const hapusMenu = async (id: string) => {
    await deleteMenu(id);
    toast.success("Menu dihapus.");
    refetchAll();
  };

  if (menusQ.isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex-1 space-y-1.5">
          <Label>Nama menu baru</Label>
          <Input
            value={namaBaru}
            onChange={(e) => setNamaBaru(e.target.value)}
            placeholder="mis. Nasi Goreng, Sarapan Warung"
          />
        </div>
        <Button onClick={buat} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Buat Menu
        </Button>
      </div>

      {menus.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="h-7 w-7" />}
          title="Belum ada menu"
          desc="Buat menu, lalu tambahkan komponennya (bahan belanja atau biaya beli-jadi)."
        />
      ) : (
        <div className="space-y-3">
          {menus.map((m) => (
            <MenuCard
              key={m.id}
              menu={m}
              komponen={kompByMenu.get(m.id) ?? []}
              onChanged={refetchAll}
              onDelete={() => hapusMenu(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuCard({
  menu,
  komponen,
  onChanged,
  onDelete,
}: {
  menu: { id: string; nama: string };
  komponen: MenuKomponenRow[];
  onChanged: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
        <span className="font-semibold">{menu.nama}</span>
        <div className="flex items-center gap-1">
          <AddKomponenDialog menuId={menu.id} onAdded={onChanged} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus menu {menu.nama}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Menu & komponennya akan dihapus. Rencana yang memakai menu ini juga ikut hilang.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Hapus</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {komponen.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          Belum ada komponen. Tambahkan bahan belanja atau biaya beli-jadi.
        </p>
      ) : (
        <ul className="divide-y">
          {komponen.map((k) => (
            <li key={k.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              {k.tipe === "belanja" ? (
                <ShoppingCart className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Receipt className="h-4 w-4 shrink-0 text-info" />
              )}
              <span className="min-w-0 flex-1 truncate">{k.nama}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {k.tipe === "belanja" ? `${k.jumlah} ${k.satuan}` : formatRupiah(k.perkiraan_biaya)}
              </span>
              <button
                onClick={() => deleteKomponen(k.id).then(onChanged)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Hapus komponen"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddKomponenDialog({ menuId, onAdded }: { menuId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [tipe, setTipe] = useState<TipeKomponen>("belanja");
  const [nama, setNama] = useState("");
  const [itemId, setItemId] = useState<string | null>(null);
  const [kategoriBarangId, setKategoriBarangId] = useState<string | null>(null);
  const [jumlah, setJumlah] = useState("1");
  const [satuan, setSatuan] = useState("pcs");
  const [biaya, setBiaya] = useState("");
  const [katPengeluaranId, setKatPengeluaranId] = useState("");
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
  const katPengeluaranQ = useQuery({
    queryKey: ["kategori-pengeluaran"],
    queryFn: () => getKategoriPengeluaran(),
  });

  const reset = () => {
    setTipe("belanja");
    setNama("");
    setItemId(null);
    setKategoriBarangId(null);
    setJumlah("1");
    setSatuan("pcs");
    setBiaya("");
    setKatPengeluaranId("");
  };

  const simpan = async () => {
    if (!nama.trim()) {
      toast.error("Isi nama komponen.");
      return;
    }
    setSaving(true);
    try {
      await addKomponen(menuId, {
        tipe,
        item_id: tipe === "belanja" ? itemId : null,
        kategori_barang_id: tipe === "belanja" ? kategoriBarangId : null,
        nama: nama.trim(),
        jumlah: tipe === "belanja" ? Number(jumlah) || 1 : 1,
        satuan: tipe === "belanja" ? satuan : "pcs",
        perkiraan_biaya: tipe === "pengeluaran" ? Number(biaya) || 0 : 0,
        kategori_pengeluaran_id: tipe === "pengeluaran" ? katPengeluaranId || null : null,
      });
      reset();
      setOpen(false);
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menambah komponen.");
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
        <Button variant="ghost" size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah komponen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Tipe */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={tipe === "belanja" ? "default" : "outline"}
              onClick={() => setTipe("belanja")}
            >
              <ShoppingCart className="mr-2 h-4 w-4" /> Bahan belanja
            </Button>
            <Button
              type="button"
              variant={tipe === "pengeluaran" ? "default" : "outline"}
              onClick={() => setTipe("pengeluaran")}
            >
              <Receipt className="mr-2 h-4 w-4" /> Beli jadi
            </Button>
          </div>

          {tipe === "belanja" ? (
            <>
              <div className="space-y-1.5">
                <Label>Pilih dari master item (opsional)</Label>
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
                <Label>Nama bahan</Label>
                <Input
                  value={nama}
                  onChange={(e) => {
                    setNama(e.target.value);
                    setItemId(null);
                  }}
                  placeholder="mis. Beras, Telur"
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
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Deskripsi</Label>
                <Input
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="mis. Pecel warung Bu Sri"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Perkiraan biaya (Rp)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={biaya}
                    onChange={(e) => setBiaya(e.target.value)}
                    placeholder="15000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kategori</Label>
                  <Select value={katPengeluaranId} onValueChange={setKatPengeluaranId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {(katPengeluaranQ.data ?? []).map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={simpan} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Tambahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
