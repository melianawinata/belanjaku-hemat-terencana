import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, logActivity } from "@/lib/useAuth";
import { formatRupiah } from "@/lib/format";
import { usePeriode } from "@/lib/periode";
import { getOrCreateBelanja, BelanjaItemRow } from "@/lib/belanja";
import { compressImageToBase64 } from "@/lib/image";
import { scanStrukAI, StrukResult } from "@/lib/api/scan-struk.functions";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowLeft,
  ScanLine,
  Camera,
  Loader2,
  Check,
  ChevronsUpDown,
  AlertTriangle,
  Link2,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/scan-struk")({
  head: () => ({ meta: [{ title: "Scan Struk — BelanjaKu" }] }),
  component: ScanStrukPage,
});

type MasterItem = {
  id: string;
  nama: string;
  kategori_barang_id: string | null;
  satuan_default: string;
};

// Baris kerja di layar review — diturunkan dari hasil AI, lalu bisa dikoreksi user.
interface Row {
  key: string;
  nama_struk: string;
  nama_normal: string | null;
  qty: number;
  satuan: string | null;
  harga_total: number;
  keyakinan: "tinggi" | "sedang" | "rendah";
  mode: "match" | "new" | "ignore";
  matchId: string | null; // belanja_item id saat mode "match"
  linkItemId: string | null; // master item id (opsional) saat mode "new"
  linkNama: string;
  linkKategoriId: string | null;
  linkSatuan: string;
  include: boolean;
}

function ScanStrukPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { bulan, tahun } = usePeriode();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<"upload" | "loading" | "review">("upload");
  const [result, setResult] = useState<StrukResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [tokoId, setTokoId] = useState<string>("");
  const [applying, setApplying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["scan-struk-ctx", userId, bulan, tahun],
    enabled: !!userId,
    queryFn: async () => {
      const belanja = await getOrCreateBelanja(userId!, bulan, tahun);
      const { data: items } = await supabase
        .from("belanja_item")
        .select("*")
        .eq("belanja_id", belanja.id)
        .order("created_at");
      const { data: toko } = await supabase.from("toko").select("id, nama").order("nama");
      const { data: master } = await supabase
        .from("item")
        .select("id, nama, kategori_barang_id, satuan_default")
        .order("nama");
      return {
        belanja,
        items: (items ?? []) as BelanjaItemRow[],
        toko: toko ?? [],
        master: (master ?? []) as MasterItem[],
      };
    },
  });

  const belanja = data?.belanja;
  const items = data?.items ?? [];
  const toko = data?.toko ?? [];
  const master = data?.master ?? [];
  const itemById = useMemo(() => new Map((data?.items ?? []).map((i) => [i.id, i])), [data?.items]);

  const onPickFile = async (file: File | undefined) => {
    if (!file || !belanja) return;
    setPhase("loading");
    try {
      const { base64, mimeType } = await compressImageToBase64(file);
      const res = await scanStrukAI({
        data: {
          imageBase64: base64,
          mimeType,
          kandidat: items.map((i) => ({
            id: i.id,
            nama: i.nama_snapshot,
            merk: i.merk,
            satuan: i.satuan,
          })),
        },
      });
      if (res.items.length === 0) {
        toast.error("Tak ada item terbaca dari struk. Coba foto lebih jelas.");
        setPhase("upload");
        return;
      }
      // Tebak toko dari nama terdeteksi.
      const det = (res.toko_terdeteksi ?? "").toLowerCase().trim();
      const tokoMatch = det
        ? toko.find((t) => t.nama.toLowerCase().includes(det) || det.includes(t.nama.toLowerCase()))
        : undefined;
      setTokoId(tokoMatch?.id ?? "");
      setRows(
        res.items.map((it, idx) => ({
          key: String(idx),
          nama_struk: it.nama_struk,
          nama_normal: it.nama_normal,
          qty: it.qty,
          satuan: it.satuan,
          harga_total: it.harga_total,
          keyakinan: it.keyakinan,
          mode: it.match_id ? "match" : "new",
          matchId: it.match_id,
          linkItemId: null,
          linkNama: it.nama_normal || it.nama_struk,
          linkKategoriId: null,
          linkSatuan: it.satuan || "pcs",
          include: true,
        })),
      );
      setResult(res);
      setPhase("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses struk.");
      setPhase("upload");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const includedRows = rows.filter((r) => r.include && r.mode !== "ignore");
  const totalTerapan = includedRows.reduce((s, r) => s + r.harga_total, 0);

  // Item rencana yang tidak tersentuh match manapun.
  const matchedIds = new Set(
    includedRows.filter((r) => r.mode === "match" && r.matchId).map((r) => r.matchId!),
  );
  const takAdaDiStruk = items.filter((i) => !matchedIds.has(i.id));

  const terapkan = async () => {
    if (!belanja) return;
    setApplying(true);
    try {
      const now = new Date().toISOString();
      const ops = includedRows.map((r) => {
        // Nama mentah dari struk = varian/merk persis yang dibeli (mis. item rencana
        // "Mie Instan" → struk "INDOMIE GORENG SPESIAL"). Simpan ke Merk/Varian.
        const merkStruk = r.nama_struk.trim() || null;
        if (r.mode === "match" && r.matchId) {
          return supabase
            .from("belanja_item")
            .update({
              merk: merkStruk,
              harga_aktual: r.harga_total,
              harga_sumber: "scan",
              sudah_dibeli: true,
              dibeli_at: now,
              jumlah: r.qty,
              toko_id: tokoId || null,
            })
            .eq("id", r.matchId);
        }
        return supabase.from("belanja_item").insert({
          belanja_id: belanja.id,
          user_id: userId!,
          item_id: r.linkItemId,
          nama_snapshot: r.linkNama,
          // Hindari duplikasi bila nama item == nama struk (tak ada normalisasi).
          merk: merkStruk && merkStruk !== r.linkNama.trim() ? merkStruk : null,
          kategori_barang_id: r.linkKategoriId,
          jumlah: r.qty,
          satuan: r.linkSatuan,
          estimasi_harga: 0,
          harga_aktual: r.harga_total,
          harga_sumber: "scan",
          sudah_dibeli: true,
          dibeli_at: now,
          toko_id: tokoId || null,
        });
      });
      await Promise.all(ops);
      await logActivity(
        userId!,
        "scan",
        `Scan struk — ${includedRows.length} item, ${formatRupiah(totalTerapan)}`,
      );
      queryClient.invalidateQueries();
      toast.success(`${includedRows.length} item diterapkan dari struk.`);
      navigate({ to: "/app/mulai-belanja" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menerapkan.");
    } finally {
      setApplying(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Scan Struk" />
        <Skeleton className="h-40" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Scan Struk"
        subtitle="Foto struk, biarkan AI mengisi harga belanjamu"
        action={
          <Link to="/app/mulai-belanja">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
          </Link>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPickFile(e.target.files?.[0])}
      />

      {phase === "upload" && (
        <EmptyState
          icon={<ScanLine className="h-7 w-7" />}
          title="Scan struk belanjamu"
          desc="Foto struk yang jelas & rata. AI akan membaca item dan harganya, lalu mencocokkannya dengan daftar belanjamu. Hasilnya bisa kamu koreksi sebelum disimpan."
          action={
            <Button size="lg" onClick={() => fileRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" /> Ambil / Pilih Foto
            </Button>
          }
        />
      )}

      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Membaca struk…</p>
        </div>
      )}

      {phase === "review" && result && (
        <div className="space-y-5 pb-4">
          {/* Ringkasan */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Toko</Label>
                <Select value={tokoId} onValueChange={setTokoId}>
                  <SelectTrigger className="h-9">
                    <SelectValue
                      placeholder={
                        result.toko_terdeteksi
                          ? `Terdeteksi: ${result.toko_terdeteksi}`
                          : "Pilih toko"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {toko.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {result.toko_terdeteksi && !tokoId && (
                  <p className="text-[11px] text-muted-foreground">
                    Struk: “{result.toko_terdeteksi}” — tak ada di daftar toko, pilih manual.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ringkasan</Label>
                <p className="font-mono text-sm">
                  Terapkan {formatRupiah(totalTerapan)}
                  {result.total_struk != null && (
                    <span className="text-muted-foreground">
                      {" "}
                      · struk {formatRupiah(result.total_struk)}
                    </span>
                  )}
                </p>
                {result.total_struk != null &&
                  Math.abs(result.total_struk - totalTerapan) >
                    Math.max(1000, result.total_struk * 0.05) && (
                    <p className="flex items-center gap-1 text-[11px] text-warning">
                      <AlertTriangle className="h-3 w-3" /> Selisih dengan total struk — cek ada
                      baris terlewat.
                    </p>
                  )}
              </div>
            </div>
          </div>

          {/* Daftar item dari struk */}
          <div className="space-y-2">
            <p className="px-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Item dari struk ({rows.length})
            </p>
            {rows.map((r) => (
              <RowCard
                key={r.key}
                row={r}
                items={items}
                master={master}
                itemById={itemById}
                onPatch={patchRow}
              />
            ))}
          </div>

          {/* Tak ada di struk */}
          {takAdaDiStruk.length > 0 && (
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Tak ada di struk ({takAdaDiStruk.length})
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {takAdaDiStruk.map((i) => (
                  <li key={i.id}>
                    • {i.nama_snapshot} <span className="text-xs">— dibiarkan belum dibeli</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer aksi */}
          <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-lg lg:bottom-4">
            <Button
              variant="outline"
              onClick={() => {
                setPhase("upload");
                setResult(null);
                setRows([]);
              }}
            >
              Ganti Foto
            </Button>
            <Button size="lg" onClick={terapkan} disabled={applying || includedRows.length === 0}>
              {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Terapkan (
              {includedRows.length})
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

const KEYAKINAN_STYLE: Record<Row["keyakinan"], string> = {
  tinggi: "bg-success/10 text-success",
  sedang: "bg-warning/10 text-warning",
  rendah: "bg-muted text-muted-foreground",
};

function RowCard({
  row,
  items,
  master,
  itemById,
  onPatch,
}: {
  row: Row;
  items: BelanjaItemRow[];
  master: MasterItem[];
  itemById: Map<string, BelanjaItemRow>;
  onPatch: (key: string, patch: Partial<Row>) => void;
}) {
  const planned = row.mode === "match" && row.matchId ? itemById.get(row.matchId) : undefined;
  const qtyMismatch = planned && Number(planned.jumlah) !== row.qty;

  return (
    <div
      className={`rounded-2xl border p-3 shadow-sm ${row.include ? "bg-card" : "bg-muted/30 opacity-60"}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          className="mt-1"
          checked={row.include}
          onCheckedChange={(v) => onPatch(row.key, { include: !!v })}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.nama_normal || row.nama_struk}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                struk: “{row.nama_struk}” · {row.qty} {row.satuan ?? ""}
              </p>
            </div>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${KEYAKINAN_STYLE[row.keyakinan]}`}
            >
              {row.keyakinan}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
              <span>Rp</span>
              <Input
                type="number"
                className="h-7 w-24 text-xs"
                value={String(row.harga_total)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isNaN(n)) onPatch(row.key, { harga_total: n });
                }}
              />
            </div>
            <MatchPicker row={row} items={items} onPatch={onPatch} />
          </div>

          {qtyMismatch && (
            <p className="flex items-center gap-1 text-[11px] text-warning">
              <AlertTriangle className="h-3 w-3" /> rencana {planned!.jumlah} → struk {row.qty}{" "}
              (jumlah akan disesuaikan ke struk)
            </p>
          )}

          {row.mode === "new" && <NewItemLink row={row} master={master} onPatch={onPatch} />}
        </div>
      </div>
    </div>
  );
}

// Pemilih tujuan: cocokkan ke item rencana, jadikan item baru, atau abaikan.
function MatchPicker({
  row,
  items,
  onPatch,
}: {
  row: Row;
  items: BelanjaItemRow[];
  onPatch: (key: string, patch: Partial<Row>) => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    row.mode === "match"
      ? (items.find((i) => i.id === row.matchId)?.nama_snapshot ?? "item rencana")
      : row.mode === "new"
        ? "✛ Item baru"
        : "✕ Diabaikan";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 max-w-[60%] justify-between gap-1 text-xs font-normal"
        >
          <span className="truncate">→ {label}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari item rencana…" />
          <CommandList>
            <CommandEmpty>Tidak ada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__baru__"
                onSelect={() => {
                  onPatch(row.key, { mode: "new", matchId: null });
                  setOpen(false);
                }}
              >
                <Check
                  className={`mr-2 h-4 w-4 ${row.mode === "new" ? "opacity-100" : "opacity-0"}`}
                />{" "}
                ✛ Jadikan item baru
              </CommandItem>
              <CommandItem
                value="__abaikan__"
                onSelect={() => {
                  onPatch(row.key, { mode: "ignore", matchId: null });
                  setOpen(false);
                }}
              >
                <Check
                  className={`mr-2 h-4 w-4 ${row.mode === "ignore" ? "opacity-100" : "opacity-0"}`}
                />{" "}
                ✕ Abaikan baris ini
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Item rencana">
              {items.map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.nama_snapshot + i.id}
                  onSelect={() => {
                    onPatch(row.key, { mode: "match", matchId: i.id });
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${row.matchId === i.id ? "opacity-100" : "opacity-0"}`}
                  />
                  {i.nama_snapshot}
                  {i.merk && <span className="ml-1 text-xs text-muted-foreground">({i.merk})</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Untuk item baru: tawarkan tautan ke item katalog (master) dulu — bila cocok,
// item_id terisi sehingga harga ikut masuk histori. Bila tidak, jadi item sekali pakai.
function NewItemLink({
  row,
  master,
  onPatch,
}: {
  row: Row;
  master: MasterItem[];
  onPatch: (key: string, patch: Partial<Row>) => void;
}) {
  const [open, setOpen] = useState(false);
  const linked = row.linkItemId ? master.find((m) => m.id === row.linkItemId) : undefined;

  return (
    <div className="flex items-center gap-2">
      {row.linkItemId ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          <Link2 className="h-2.5 w-2.5" /> {linked?.nama ?? "katalog"}
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          <Sparkles className="h-2.5 w-2.5" /> item baru
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground">
            {row.linkItemId ? "ganti tautan" : "tautkan ke katalog"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Cari item katalog…" />
            <CommandList>
              <CommandEmpty>Tidak ditemukan.</CommandEmpty>
              {row.linkItemId && (
                <CommandGroup>
                  <CommandItem
                    value="__lepas__"
                    onSelect={() => {
                      onPatch(row.key, { linkItemId: null, linkKategoriId: null });
                      setOpen(false);
                    }}
                  >
                    ✕ Lepas tautan (item sekali pakai)
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {master.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={m.nama}
                    onSelect={() => {
                      onPatch(row.key, {
                        linkItemId: m.id,
                        linkNama: m.nama,
                        linkKategoriId: m.kategori_barang_id,
                        linkSatuan: row.satuan || m.satuan_default,
                      });
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${row.linkItemId === m.id ? "opacity-100" : "opacity-0"}`}
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
  );
}
