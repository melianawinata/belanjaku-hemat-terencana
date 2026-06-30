import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { getKonversi, addKonversi, deleteKonversi, setSatuanTampilan } from "@/lib/stok";
import { formatNumber } from "@/lib/format";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Ruler, Star } from "lucide-react";

/** Form kecil "1 <satuan> = faktor <dasar>" — dipakai di popover & dialog. */
function TambahKonversiForm({
  itemId,
  baseSatuan,
  onSaved,
}: {
  itemId: string;
  baseSatuan: string;
  onSaved: (satuan: string) => void;
}) {
  const { userId } = useAuth();
  const [satuan, setSatuan] = useState("");
  // Jumlah satuan ini dalam 1 satuan dasar (mis. 1 kg = 16 butir → "16").
  const [perDasar, setPerDasar] = useState("");
  const [saving, setSaving] = useState(false);

  const simpan = async () => {
    const n = Number(perDasar);
    if (!satuan.trim()) {
      toast.error("Isi nama satuan baru.");
      return;
    }
    if (!(n > 0)) {
      toast.error(`Isi berapa ${satuan.trim() || "satuan"} dalam 1 ${baseSatuan}.`);
      return;
    }
    setSaving(true);
    try {
      // DB menyimpan faktor = 1 <satuan> dalam satuan dasar = kebalikan dari input.
      await addKonversi(userId!, itemId, satuan.trim(), 1 / n);
      onSaved(satuan.trim());
      setSatuan("");
      setPerDasar("");
      toast.success("Konversi disimpan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan konversi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Tambah satuan lain untuk barang ini (satuan dasar: <strong>{baseSatuan}</strong>).
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Satuan</Label>
        <Input
          value={satuan}
          onChange={(e) => setSatuan(e.target.value)}
          placeholder="mis. butir"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">1 {baseSatuan} sama dengan…</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step="any"
            value={perDasar}
            onChange={(e) => setPerDasar(e.target.value)}
            placeholder="16"
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground">{satuan.trim() || "satuan"}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Contoh telur: 1 kg = 16 butir.</p>
      <Button type="button" size="sm" onClick={simpan} disabled={saving} className="w-full">
        {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        Simpan konversi
      </Button>
    </div>
  );
}

/**
 * Pemilih satuan untuk komponen bahan / item belanja.
 * - Item master (itemId + baseSatuan): dropdown {satuan dasar + konversi} +
 *   tombol "+" (popover) untuk menambah konversi → cegah satuan tak terkonversi.
 * - Item bebas: input teks biasa.
 */
export function SatuanField({
  itemId,
  baseSatuan,
  value,
  onChange,
}: {
  itemId: string | null;
  baseSatuan: string | null;
  value: string;
  onChange: (satuan: string) => void;
}) {
  const { userId } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const konversiQ = useQuery({
    queryKey: ["konversi", userId, itemId],
    enabled: !!userId && !!itemId,
    queryFn: () => getKonversi(userId!, itemId!),
  });

  if (!itemId || !baseSatuan) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} />;
  }

  const options = Array.from(new Set([baseSatuan, ...(konversiQ.data ?? []).map((k) => k.satuan)]));

  return (
    <div className="flex items-center gap-1">
      <Select value={options.includes(value) ? value : baseSatuan} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
              {s === baseSatuan ? " (dasar)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" title="Tambah satuan/konversi">
            <Plus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <TambahKonversiForm
            itemId={itemId}
            baseSatuan={baseSatuan}
            onSaved={async (s) => {
              await konversiQ.refetch();
              onChange(s);
              setAddOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Dialog kelola konversi satuan untuk satu barang stok master
 * (lihat/tambah/hapus). Hanya untuk item master (item_id tak null).
 */
export function KelolaKonversiDialog({
  itemId,
  baseSatuan,
  nama,
}: {
  itemId: string;
  baseSatuan: string;
  nama: string;
}) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const konversiQ = useQuery({
    queryKey: ["konversi", userId, itemId],
    enabled: open && !!userId,
    queryFn: () => getKonversi(userId!, itemId),
  });
  const rows = konversiQ.data ?? [];

  // Saldo stok ditampilkan ulang saat satuan tampilan berubah.
  const segarkanTampilan = () => {
    queryClient.invalidateQueries({ queryKey: ["satuan-tampilan", userId] });
  };

  const hapus = async (id: string) => {
    try {
      await deleteKonversi(id);
      await konversiQ.refetch();
      segarkanTampilan();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  };

  const jadikanTampilan = async (id: string) => {
    try {
      await setSatuanTampilan(userId!, itemId, id);
      await konversiQ.refetch();
      segarkanTampilan();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah satuan tampilan.");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Konversi satuan">
          <Ruler className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-semibold">Konversi satuan — {nama}</p>
          <p className="text-xs text-muted-foreground">
            Satuan dasar <strong>{baseSatuan}</strong>. Bintang = satuan yang ditampilkan di stok.
          </p>
        </div>
        {konversiQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Memuat…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada konversi.</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((k) => (
              <li key={k.id} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => jadikanTampilan(k.id)}
                  className={
                    k.tampilan ? "text-warning" : "text-muted-foreground hover:text-warning"
                  }
                  title={k.tampilan ? "Satuan tampilan stok" : "Jadikan satuan tampilan stok"}
                  aria-label="Satuan tampilan"
                >
                  <Star className={`h-3.5 w-3.5 ${k.tampilan ? "fill-current" : ""}`} />
                </button>
                <span className="flex-1">
                  1 {baseSatuan} = {formatNumber(1 / k.faktor)} {k.satuan}
                </span>
                <button
                  onClick={() => hapus(k.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Hapus konversi"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t pt-3">
          <TambahKonversiForm
            itemId={itemId}
            baseSatuan={baseSatuan}
            onSaved={() => {
              konversiQ.refetch();
              segarkanTampilan();
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
