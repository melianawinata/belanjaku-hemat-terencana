import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, logActivity } from "@/lib/useAuth";
import { bulanIni, formatRupiah, namaBulan } from "@/lib/format";
import {
  getOrCreateBelanja,
  getEstimasiHarga,
  totalEstimasi,
  totalRealisasi,
  BelanjaItemRow,
} from "@/lib/belanja";
import { estimasiHargaAI } from "@/lib/api/estimasi-harga.functions";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, Skeleton, DraftInput } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ShoppingCart,
  CalendarClock,
  LayoutTemplate,
  Loader2,
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/belanja")({
  head: () => ({ meta: [{ title: "Belanja Bulan Ini — BelanjaKu" }] }),
  component: BelanjaPage,
});

function BelanjaPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { bulan, tahun } = bulanIni();
  const [starting, setStarting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRowId, setAiRowId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["belanja", userId, bulan, tahun],
    enabled: !!userId,
    queryFn: async () => {
      const belanja = await getOrCreateBelanja(userId!, bulan, tahun);
      const { data: items } = await supabase
        .from("belanja_item")
        .select("*")
        .eq("belanja_id", belanja.id)
        .order("created_at");
      const { data: kat } = await supabase.from("kategori_barang").select("id, nama");
      return { belanja, items: (items ?? []) as BelanjaItemRow[], kategori: kat ?? [] };
    },
  });

  const belanja = data?.belanja;
  const items = data?.items ?? [];
  const budget = Number(belanja?.budget ?? 0);
  const estimasi = totalEstimasi(items);
  const ratio = budget > 0 ? estimasi / budget : 0;
  const dibeliTotal = totalRealisasi(items);
  const dibeliCount = items.filter((i) => i.sudah_dibeli).length;

  // If already shopping, send to mulai-belanja
  if (belanja?.status === "belanja") {
    navigate({ to: "/app/mulai-belanja" });
  }

  const katNama = new Map((data?.kategori ?? []).map((k) => [k.id, k.nama]));
  const grouped = new Map<string, BelanjaItemRow[]>();
  items.forEach((i) => {
    const key = i.kategori_barang_id ?? "lain";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(i);
  });

  const deleteItem = async (id: string) => {
    await supabase.from("belanja_item").delete().eq("id", id);
    toast.success("Item dihapus.");
    refetch();
  };

  const updateItem = async (id: string, patch: Partial<BelanjaItemRow>) => {
    await supabase.from("belanja_item").update(patch).eq("id", id);
    refetch();
  };

  // AI estimate for a single row. Always overrides (manual button = "I want
  // an AI number here"), and marks the source so the badge shows up.
  const estimasiRowAI = async (i: BelanjaItemRow) => {
    setAiRowId(i.id);
    try {
      const { hasil } = await estimasiHargaAI({
        data: { items: [{ nama: i.nama_snapshot, merk: i.merk, satuan: i.satuan }] },
      });
      const h = hasil[0];
      if (!h) {
        toast.error("AI tidak bisa memperkirakan item ini.");
        return;
      }
      await supabase
        .from("belanja_item")
        .update({ estimasi_harga: h.harga_estimasi, estimasi_sumber: "ai" })
        .eq("id", i.id);
      toast.success(`Perkiraan AI: ${formatRupiah(h.harga_estimasi)} / ${i.satuan}`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengambil perkiraan AI.");
    } finally {
      setAiRowId(null);
    }
  };

  // Batch estimate for the whole list. Fallback-only: skips rows that already
  // have a price (from histori or a previous estimate) so we never overwrite
  // the user's own data and don't waste calls.
  const estimasiBatchAI = async () => {
    const targets = items.filter((i) => Number(i.estimasi_harga) <= 0);
    if (targets.length === 0) {
      toast.info("Semua item sudah punya estimasi harga.");
      return;
    }
    setAiLoading(true);
    try {
      const { hasil } = await estimasiHargaAI({
        data: {
          items: targets.map((t) => ({ nama: t.nama_snapshot, merk: t.merk, satuan: t.satuan })),
        },
      });
      const updates = targets.map((t, idx) => ({ t, h: hasil[idx] })).filter((x) => x.h);
      await Promise.all(
        updates.map(({ t, h }) =>
          supabase
            .from("belanja_item")
            .update({ estimasi_harga: h!.harga_estimasi, estimasi_sumber: "ai" })
            .eq("id", t.id),
        ),
      );
      const missed = targets.length - updates.length;
      toast.success(
        `${updates.length} item diperkirakan oleh AI${missed > 0 ? ` (${missed} dilewati)` : ""}.`,
      );
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengambil perkiraan AI.");
    } finally {
      setAiLoading(false);
    }
  };

  const mulaiBelanja = async () => {
    if (!belanja) return;
    setStarting(true);
    await supabase.from("belanja_bulanan").update({ status: "belanja" }).eq("id", belanja.id);
    await logActivity(userId!, "belanja", `Mulai belanja ${namaBulan(bulan)} ${tahun}`);
    queryClient.invalidateQueries({ queryKey: ["belanja"] });
    navigate({ to: "/app/mulai-belanja" });
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Belanja Bulan Ini" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Belanja Bulan Ini"
        subtitle={`Daftar kebutuhan ${namaBulan(bulan)} ${tahun}`}
        action={
          belanja && (
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <Button variant="outline" onClick={estimasiBatchAI} disabled={aiLoading}>
                  {aiLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Perkiraan AI
                </Button>
              )}
              <AddItemDialog belanjaId={belanja.id} userId={userId!} onDone={refetch} />
            </div>
          )
        }
      />

      {/* Budget warning */}
      {budget > 0 && ratio >= 0.8 && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl border p-3 text-sm ${ratio > 1 ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-warning/30 bg-warning/10 text-warning"}`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {ratio > 1
            ? `Estimasi belanja (${formatRupiah(estimasi)}) sudah melebihi budget (${formatRupiah(budget)}).`
            : `Estimasi belanja sudah mencapai ${(ratio * 100).toFixed(0)}% dari budget.`}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-7 w-7" />}
          title="Daftar belanjamu masih kosong"
          desc="Yuk mulai susun kebutuhan bulan ini — tambah manual, ambil dari bulan lalu, atau pakai template kategori."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {belanja && (
                <AddItemDialog belanjaId={belanja.id} userId={userId!} onDone={refetch} />
              )}
              <Link to="/app/generate" search={{ mode: "bulan-lalu" }}>
                <Button variant="outline">
                  <CalendarClock className="mr-2 h-4 w-4" /> Ambil dari Bulan Lalu
                </Button>
              </Link>
              <Link to="/app/generate" search={{ mode: "template" }}>
                <Button variant="outline">
                  <LayoutTemplate className="mr-2 h-4 w-4" /> Template Kategori
                </Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Link to="/app/generate" search={{ mode: "bulan-lalu" }}>
              <Button variant="outline" size="sm">
                <CalendarClock className="mr-2 h-4 w-4" /> Ambil dari Bulan Lalu
              </Button>
            </Link>
            <Link to="/app/generate" search={{ mode: "template" }}>
              <Button variant="outline" size="sm">
                <LayoutTemplate className="mr-2 h-4 w-4" /> Template Kategori
              </Button>
            </Link>
          </div>

          {[...grouped.entries()].map(([katId, rows]) => {
            const subtotal = rows.reduce(
              (s, i) => s + Number(i.estimasi_harga) * Number(i.jumlah),
              0,
            );
            return (
              <div key={katId} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {katNama.get(katId) ?? "Lainnya"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatRupiah(subtotal)}
                  </span>
                </div>
                <ul className="divide-y">
                  {rows.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {i.nama_snapshot}
                          {i.merk && (
                            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                              {i.merk}
                            </span>
                          )}
                          {i.sudah_dibeli && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                              <Check className="h-3 w-3" /> Dibeli
                            </span>
                          )}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs text-muted-foreground">
                          <span>Rp</span>
                          <DraftInput
                            type="number"
                            value={String(i.estimasi_harga)}
                            inputClassName="h-7 w-24 text-xs"
                            onCommit={(raw) => {
                              const n = Number(raw);
                              if (raw.trim() !== "" && !Number.isNaN(n) && n >= 0)
                                updateItem(i.id, { estimasi_harga: n, estimasi_sumber: "manual" });
                            }}
                          />
                          <span>/ {i.satuan}</span>
                          {i.estimasi_sumber === "ai" && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              <Sparkles className="h-2.5 w-2.5" /> AI
                            </span>
                          )}
                          <span>
                            · subtotal {formatRupiah(Number(i.estimasi_harga) * Number(i.jumlah))}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <DraftInput
                          type="number"
                          value={String(i.jumlah)}
                          inputClassName="h-8 w-16 text-center"
                          onCommit={(raw) => {
                            const n = Number(raw);
                            if (raw.trim() !== "" && !Number.isNaN(n) && n > 0)
                              updateItem(i.id, { jumlah: n });
                          }}
                        />
                        <DraftInput
                          value={i.satuan}
                          inputClassName="h-8 w-16 text-center"
                          onCommit={(raw) => {
                            const v = raw.trim();
                            if (v) updateItem(i.id, { satuan: v });
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => estimasiRowAI(i)}
                        disabled={aiRowId === i.id}
                        title="Perkirakan harga dengan AI"
                      >
                        {aiRowId === i.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-primary" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteItem(i.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* Total + start */}
          <div className="sticky bottom-20 z-20 rounded-2xl border bg-card p-4 shadow-lg lg:bottom-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Total Estimasi
                </p>
                <p className="font-mono text-xl font-semibold">{formatRupiah(estimasi)}</p>
                {budget > 0 && (
                  <p className="text-xs text-muted-foreground">
                    dari budget {formatRupiah(budget)}
                  </p>
                )}
                {dibeliCount > 0 && (
                  <p className="mt-1 font-mono text-xs text-success">
                    Sudah dibeli: {formatRupiah(dibeliTotal)} ({dibeliCount} item)
                  </p>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="lg">
                    <ShoppingCart className="mr-2 h-4 w-4" /> Mulai Belanja
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mulai belanja sekarang?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Daftar akan masuk mode belanja. Kamu bisa centang item & catat harga aktual
                      saat di toko.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={mulaiBelanja} disabled={starting}>
                      {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Ya, Mulai
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AddItemDialog({
  belanjaId,
  userId,
  onDone,
}: {
  belanjaId: string;
  userId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    id: string | null;
    nama: string;
    kategori_barang_id: string | null;
    satuan: string;
  } | null>(null);
  const [manualNama, setManualNama] = useState("");
  const [merk, setMerk] = useState("");
  const [jumlah, setJumlah] = useState("1");
  const [satuan, setSatuan] = useState("pcs");
  const [saving, setSaving] = useState(false);

  const { data: master } = useQuery({
    queryKey: ["master_item"],
    queryFn: async () => {
      const { data } = await supabase
        .from("item")
        .select("id, nama, kategori_barang_id, satuan_default")
        .order("nama");
      return data ?? [];
    },
  });

  const reset = () => {
    setSelectedItem(null);
    setManualNama("");
    setMerk("");
    setJumlah("1");
    setSatuan("pcs");
  };

  const save = async () => {
    const nama = selectedItem?.nama || manualNama.trim();
    if (!nama) {
      toast.error("Pilih atau ketik nama item.");
      return;
    }
    setSaving(true);
    const merkVal = merk.trim() || null;
    const estimasi = selectedItem?.id
      ? await getEstimasiHarga(userId, selectedItem.id, merkVal)
      : 0;
    await supabase.from("belanja_item").insert({
      belanja_id: belanjaId,
      user_id: userId,
      item_id: selectedItem?.id ?? null,
      nama_snapshot: nama,
      merk: merkVal,
      kategori_barang_id: selectedItem?.kategori_barang_id ?? null,
      jumlah: Number(jumlah) || 1,
      satuan,
      estimasi_harga: estimasi,
      estimasi_sumber: estimasi > 0 ? "histori" : null,
    });
    setSaving(false);
    toast.success("Item ditambahkan.");
    reset();
    setOpen(false);
    onDone();
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
          <Plus className="mr-2 h-4 w-4" /> Tambah Item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Item Belanja</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Pilih dari daftar item</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {selectedItem ? selectedItem.nama : "Cari item..."}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cari item..." />
                  <CommandList>
                    <CommandEmpty>Tidak ditemukan. Ketik manual di bawah.</CommandEmpty>
                    <CommandGroup>
                      {(master ?? []).map((m) => (
                        <CommandItem
                          key={m.id}
                          value={m.nama}
                          onSelect={() => {
                            setSelectedItem({
                              id: m.id,
                              nama: m.nama,
                              kategori_barang_id: m.kategori_barang_id,
                              satuan: m.satuan_default,
                            });
                            setSatuan(m.satuan_default);
                            setManualNama("");
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${selectedItem?.id === m.id ? "opacity-100" : "opacity-0"}`}
                          />
                          {m.nama}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label>Atau ketik item baru</Label>
            <Input
              value={manualNama}
              onChange={(e) => {
                setManualNama(e.target.value);
                setSelectedItem(null);
              }}
              placeholder="Nama item baru"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Merk / Varian <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <Input
              value={merk}
              onChange={(e) => setMerk(e.target.value)}
              placeholder="mis. Merk A, kemasan 5kg"
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
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Tambahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
