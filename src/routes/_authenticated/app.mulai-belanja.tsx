import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { bulanIni, formatRupiah, namaBulan } from "@/lib/format";
import { getOrCreateBelanja, totalRealisasi, BelanjaItemRow } from "@/lib/belanja";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ShoppingCart, CheckCircle2, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/mulai-belanja")({
  head: () => ({ meta: [{ title: "Mulai Belanja — BelanjaKu" }] }),
  component: MulaiBelanja,
});

function MulaiBelanja() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { bulan, tahun } = bulanIni();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["mulai-belanja", userId, bulan, tahun],
    enabled: !!userId,
    queryFn: async () => {
      const belanja = await getOrCreateBelanja(userId!, bulan, tahun);
      const { data: items } = await supabase.from("belanja_item").select("*").eq("belanja_id", belanja.id).order("created_at");
      const { data: toko } = await supabase.from("toko").select("id, nama").order("nama");
      return { belanja, items: (items ?? []) as BelanjaItemRow[], toko: toko ?? [] };
    },
  });

  const belanja = data?.belanja;
  const items = data?.items ?? [];
  const budget = Number(belanja?.budget ?? 0);
  const realisasi = totalRealisasi(items);
  const tone = budget > 0 && realisasi > budget ? "text-destructive" : budget > 0 && realisasi / budget >= 0.8 ? "text-warning" : "text-success";
  const belumDibeli = items.filter((i) => !i.sudah_dibeli).length;

  const toggle = async (item: BelanjaItemRow, checked: boolean) => {
    await supabase.from("belanja_item").update({
      sudah_dibeli: checked,
      harga_aktual: checked ? (item.harga_aktual ?? item.estimasi_harga) : null,
      dibeli_at: checked ? new Date().toISOString() : null,
    }).eq("id", item.id);
    refetch();
  };
  const setHarga = async (id: string, harga: number) => { await supabase.from("belanja_item").update({ harga_aktual: harga }).eq("id", id); refetch(); };
  const setToko = async (id: string, toko_id: string) => { await supabase.from("belanja_item").update({ toko_id }).eq("id", id); refetch(); };
  const setMerk = async (id: string, merk: string | null) => { await supabase.from("belanja_item").update({ merk }).eq("id", id); refetch(); };

  const selesai = async () => {
    if (!belanja) return;
    queryClient.invalidateQueries({ queryKey: ["belanja"] });
    navigate({ to: "/app/selesai" });
  };

  if (isLoading) return (<><PageHeader title="Mulai Belanja" /><div className="space-y-2">{[0,1,2].map(i=><Skeleton key={i} className="h-20" />)}</div></>);

  if (belanja?.status === "selesai") {
    return (<><PageHeader title="Mulai Belanja" /><EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title="Belanja bulan ini sudah selesai"
      desc="Kamu sudah menyelesaikan belanja bulan ini. Lihat ringkasannya di History." action={<Link to="/app/history"><Button>Lihat History</Button></Link>} /></>);
  }

  if (items.length === 0) {
    return (<><PageHeader title="Mulai Belanja" /><EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Daftar masih kosong"
      desc="Tambahkan item ke daftar dulu sebelum mulai belanja." action={<Link to="/app/belanja"><Button>Susun Daftar</Button></Link>} /></>);
  }

  return (
    <>
      <PageHeader title="Mulai Belanja" subtitle={`Centang & catat harga saat belanja ${namaBulan(bulan)} ${tahun}`} />
      <div className="space-y-2 pb-4">
        {items.map((i) => (
          <div key={i.id} className={`rounded-2xl border p-4 shadow-sm transition-colors ${i.sudah_dibeli ? "border-success/30 bg-success/5" : "bg-card"}`}>
            <div className="flex items-start gap-3">
              <Checkbox className="mt-1" checked={i.sudah_dibeli} onCheckedChange={(v) => toggle(i, !!v)} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${i.sudah_dibeli ? "text-muted-foreground line-through" : ""}`}>
                  {i.nama_snapshot}{i.merk && <span className="font-normal text-muted-foreground"> ({i.merk})</span>} <span className="font-mono text-xs text-muted-foreground">· {i.jumlah} {i.satuan}</span>
                </p>
                <p className="font-mono text-xs text-muted-foreground">Estimasi {formatRupiah(i.estimasi_harga)}</p>
                {i.sudah_dibeli && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Harga aktual</Label>
                        <DraftInput type="number" value={i.harga_aktual != null ? String(i.harga_aktual) : ""}
                          onCommit={(raw) => { const n = Number(raw); if (raw.trim() !== "" && !Number.isNaN(n)) setHarga(i.id, n); }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Toko</Label>
                        <Select value={i.toko_id ?? ""} onValueChange={(v) => setToko(i.id, v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Pilih toko" /></SelectTrigger>
                          <SelectContent>
                            {(data?.toko ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.nama}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Merk / Varian <span className="font-normal text-muted-foreground">(yang benar-benar dibeli)</span></Label>
                      <DraftInput value={i.merk ?? ""} placeholder="mis. Merk B"
                        onCommit={(raw) => setMerk(i.id, raw.trim() || null)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky total */}
      <div className="sticky bottom-20 z-20 rounded-2xl border bg-card p-4 shadow-lg lg:bottom-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Total Belanja</p>
            <p className={`font-mono text-xl font-semibold ${tone}`}>{formatRupiah(realisasi)}</p>
            {budget > 0 && <p className="text-xs text-muted-foreground">dari budget {formatRupiah(budget)}</p>}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button size="lg">Selesai Belanja</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Selesaikan belanja?</AlertDialogTitle>
                <AlertDialogDescription>
                  {belumDibeli > 0
                    ? `Masih ada ${belumDibeli} item yang belum dicentang. Lanjut tetap selesai?`
                    : "Semua item sudah dicentang. Lanjut ke ringkasan?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={selesai}>Ya, Lihat Ringkasan</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  );
}

/**
 * Text/number input with local draft state so typing is instant (no per-keystroke
 * network write). Commits on blur / Enter / ✓; reverts on Esc / ✕. Auto-selects
 * on focus so the user can overwrite immediately. Used for both harga & merk.
 */
function DraftInput({ value, onCommit, type = "text", placeholder }: {
  value: string; onCommit: (raw: string) => void; type?: "text" | "number"; placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const guard = useRef(false); // once true, block commit until next focus

  // Keep draft in sync with server value while not actively editing.
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const commit = () => {
    if (guard.current) return;
    guard.current = true;
    if (draft !== value) onCommit(draft);
    setEditing(false);
    inputRef.current?.blur();
  };
  const cancel = () => {
    guard.current = true;
    setDraft(value);
    setEditing(false);
    inputRef.current?.blur();
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={draft}
        placeholder={placeholder}
        onFocus={(e) => { guard.current = false; setEditing(true); e.target.select(); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") cancel(); }}
        className="h-9"
      />
      {editing && (
        <>
          <Button type="button" size="icon" variant="ghost" aria-label="Simpan"
            className="h-9 w-9 shrink-0 text-success" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Batal"
            className="h-9 w-9 shrink-0 text-muted-foreground" onMouseDown={(e) => e.preventDefault()} onClick={cancel}>
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
