import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { formatRupiah, formatTanggal, namaBulan } from "@/lib/format";
import { usePeriode } from "@/lib/periode";
import { getOrCreateBelanja } from "@/lib/belanja";
import { getKeluargaId } from "@/lib/keluarga";
import { useKeluarga } from "@/lib/useKeluarga";
import {
  getKategoriPengeluaran, getPengeluaranLain, totalPengeluaran, pengeluaranPerKategori, tanggalHariIni,
  getPengeluaranRutin, generateRutinBulanIni, getTrenPengeluaran, METODE_BAYAR,
} from "@/lib/pengeluaran";
import type { PengeluaranLainRow, PengeluaranRutinRow } from "@/lib/pengeluaran";
import { PageHeader } from "@/components/app-shell";
import { StatCard, BudgetBar, Skeleton, EmptyState } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Receipt, Repeat, RefreshCw, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/pengeluaran")({
  head: () => ({ meta: [{ title: "Pengeluaran Lain — BelanjaKu" }] }),
  component: PengeluaranPage,
});

const CHART = ["#16A34A", "#2563EB", "#38BDF8", "#D97706", "#9333EA", "#DC2626", "#0EA5E9", "#65A30D", "#DB2777", "#475569", "#EA580C"];

function PengeluaranPage() {
  const { userId } = useAuth();
  const { bulan, tahun } = usePeriode();
  const { anggota, isKepala, memberCount } = useKeluarga();
  const namaAnggota = new Map(anggota.map((a) => [a.user_id, a.nama]));

  // Form catat pengeluaran
  const [tanggal, setTanggal] = useState(tanggalHariIni());
  const [kategoriId, setKategoriId] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [nominal, setNominal] = useState("");
  const [metode, setMetode] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter daftar & edit entri
  const [filterKat, setFilterKat] = useState("semua");
  const [editing, setEditing] = useState<PengeluaranLainRow | null>(null);

  // Pengeluaran rutin
  const [terapkan, setTerapkan] = useState(false);
  const [editRutin, setEditRutin] = useState<PengeluaranRutinRow | "baru" | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pengeluaran-lain", userId, bulan, tahun],
    enabled: !!userId,
    queryFn: async () => {
      const belanja = await getOrCreateBelanja(userId!, bulan, tahun);
      const kategori = await getKategoriPengeluaran();
      const list = await getPengeluaranLain(userId!, bulan, tahun);
      const rutin = await getPengeluaranRutin(userId!);
      const tren = await getTrenPengeluaran(userId!, bulan, tahun);
      return { belanja, kategori, list, rutin, tren };
    },
  });

  const budgetLain = Number(data?.belanja?.budget_lain ?? 0);
  const list = data?.list ?? [];
  const total = totalPengeluaran(list);
  const sisa = budgetLain - total;
  const katNama = new Map((data?.kategori ?? []).map((k) => [k.id, k.nama]));
  const perKategori = [...pengeluaranPerKategori(list).entries()]
    .map(([k, v]) => ({ nama: katNama.get(k) ?? "Tanpa kategori", value: v }))
    .sort((a, b) => b.value - a.value);
  const listTampil = filterKat === "semua" ? list : list.filter((p) => (p.kategori_pengeluaran_id ?? "lain") === filterKat);
  const rutin = data?.rutin ?? [];
  const rutinAktif = rutin.filter((r) => r.aktif);
  const rutinTercatat = new Set(list.map((p) => p.rutin_id).filter(Boolean));
  const rutinTerpasang = rutinAktif.filter((r) => rutinTercatat.has(r.id)).length;
  const adaTren = (data?.tren ?? []).some((t) => t.budget > 0 || t.terpakai > 0);

  const tambah = async () => {
    const n = Number(nominal);
    if (!nominal.trim() || Number.isNaN(n) || n <= 0) { toast.error("Nominal harus lebih dari 0."); return; }
    if (!userId) return;
    const keluargaId = data?.belanja?.keluarga_id;
    if (!keluargaId) { toast.error("Keluarga belum siap, coba lagi."); return; }
    setSaving(true);
    const { error } = await supabase.from("pengeluaran_lain").insert({
      user_id: userId, keluarga_id: keluargaId, tanggal, kategori_pengeluaran_id: kategoriId || null,
      deskripsi: deskripsi.trim(), nominal: n, metode_bayar: metode || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pengeluaran dicatat.");
    setDeskripsi(""); setNominal(""); // pertahankan tanggal, kategori & metode untuk input berturut-turut
    refetch();
  };

  const hapus = async (id: string) => {
    await supabase.from("pengeluaran_lain").delete().eq("id", id);
    toast.success("Pengeluaran dihapus.");
    refetch();
  };

  const terapkanRutin = async () => {
    if (!userId) return;
    setTerapkan(true);
    try {
      const n = await generateRutinBulanIni(userId, bulan, tahun);
      if (n > 0) toast.success(`${n} pengeluaran rutin ditambahkan untuk ${namaBulan(bulan)}.`);
      else toast.info("Semua pengeluaran rutin bulan ini sudah tercatat.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menerapkan rutin.");
    } finally {
      setTerapkan(false);
    }
  };

  const toggleRutinAktif = async (r: PengeluaranRutinRow) => {
    await supabase.from("pengeluaran_rutin").update({ aktif: !r.aktif }).eq("id", r.id);
    refetch();
  };

  const hapusRutin = async (id: string) => {
    await supabase.from("pengeluaran_rutin").delete().eq("id", id);
    toast.success("Pengeluaran rutin dihapus.");
    refetch();
  };

  if (isLoading) return (<><PageHeader title="Pengeluaran Lain" /><Skeleton className="h-40" /></>);

  const sisaTone = sisa < 0 ? "danger" : budgetLain > 0 && total / budgetLain >= 0.8 ? "warning" : "success";

  return (
    <>
      <PageHeader title="Pengeluaran Lain" subtitle={`Catat pengeluaran non-belanja ${namaBulan(bulan)} ${tahun}`} action={
        <Link to="/app/budget"><Button variant="outline"><Wallet className="mr-2 h-4 w-4" /> Atur Budget</Button></Link>
      } />

      <div className="space-y-5">
        {/* Ringkasan budget (read-only) — plafon diatur di halaman Budget */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Pemakaian vs Budget</p>
            {budgetLain === 0 && (
              <Link to="/app/budget" className="text-xs text-info hover:underline">Atur plafon di Budget →</Link>
            )}
          </div>
          <BudgetBar pemakaian={total} budget={budgetLain} />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard label="Budget Lain" value={formatRupiah(budgetLain)} />
            <StatCard label="Terpakai" value={formatRupiah(total)} tone="info" />
            <StatCard label="Sisa" value={formatRupiah(sisa)} tone={sisaTone} hint={sisa >= 0 ? "Masih ada sisa" : "Melebihi budget"} />
          </div>
        </div>

        {/* Form catat */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold">Catat Pengeluaran</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tanggal</Label>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kategori</Label>
              <Select value={kategoriId} onValueChange={setKategoriId}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {(data?.kategori ?? []).map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nominal (Rp)</Label>
              <Input type="number" inputMode="numeric" value={nominal} onChange={(e) => setNominal(e.target.value)} placeholder="25000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Deskripsi <span className="font-normal text-muted-foreground">(opsional)</span></Label>
              <Input value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="mis. GoFood ayam geprek" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Metode Bayar <span className="font-normal text-muted-foreground">(opsional)</span></Label>
              <Select value={metode} onValueChange={setMetode}>
                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent>
                  {METODE_BAYAR.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3">
            <Button onClick={tambah} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Tambah Pengeluaran</Button>
          </div>
        </div>

        {/* Rincian per kategori — chart + daftar */}
        {perKategori.length > 0 && (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Rincian per Kategori</p>
            <div className="grid items-center gap-4 sm:grid-cols-2">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={perKategori} dataKey="value" nameKey="nama" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {perKategori.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatRupiah(v)} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2">
                {perKategori.map((k, i) => (
                  <li key={k.nama} className="flex items-center justify-between text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART[i % CHART.length] }} />
                      <span className="truncate">{k.nama}</span>
                    </span>
                    <span className="ml-2 shrink-0 font-mono text-muted-foreground">{formatRupiah(k.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Pengeluaran rutin (langganan & tagihan) */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Pengeluaran Rutin</p>
              {rutinAktif.length > 0 && (
                <span className="font-mono text-[11px] text-muted-foreground">{rutinTerpasang}/{rutinAktif.length} tercatat bulan ini</span>
              )}
            </div>
            <div className="flex gap-2">
              {rutinAktif.length > 0 && (
                <Button variant="outline" size="sm" onClick={terapkanRutin} disabled={terapkan || rutinTerpasang >= rutinAktif.length}>
                  {terapkan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Terapkan bulan ini
                </Button>
              )}
              <Button size="sm" onClick={() => setEditRutin("baru")}><Plus className="mr-2 h-4 w-4" /> Tambah Rutin</Button>
            </div>
          </div>
          {rutin.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              Belum ada pengeluaran rutin. Tambahkan langganan/tagihan tetap (mis. internet, Netflix) agar bisa dicatat otomatis tiap bulan.
            </p>
          ) : (
            <ul className="divide-y">
              {rutin.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <Checkbox checked={r.aktif} onCheckedChange={() => toggleRutinAktif(r)} aria-label="Aktif" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{katNama.get(r.kategori_pengeluaran_id ?? "") ?? "Tanpa kategori"}</span>
                      <span className="font-mono text-xs text-muted-foreground">tiap tgl {r.tanggal_hari}</span>
                      {r.metode_bayar && <span className="rounded bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">{r.metode_bayar}</span>}
                      {!r.aktif && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">nonaktif</span>}
                    </div>
                    <p className={`mt-0.5 truncate text-sm ${r.aktif ? "" : "text-muted-foreground"}`}>{r.deskripsi || "(tanpa deskripsi)"}</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold">{formatRupiah(r.nominal)}</span>
                  <Button variant="ghost" size="icon" onClick={() => setEditRutin(r)}><Pencil className="h-4 w-4" /></Button>
                  {(r.user_id === userId || isKepala) && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => hapusRutin(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tren beberapa bulan */}
        {adaTren && (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Tren Pengeluaran Lain (beberapa bulan)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.tren ?? []}>
                <XAxis dataKey="label" fontSize={12} />
                <YAxis tickFormatter={(v) => `${v / 1000}k`} fontSize={11} width={36} />
                <Tooltip formatter={(v: number) => formatRupiah(v)} />
                <Legend />
                <Bar dataKey="budget" name="Budget" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="terpakai" name="Terpakai" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Daftar entri */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
            <p className="text-sm font-semibold">Daftar Pengeluaran {namaBulan(bulan)} {tahun}</p>
            {list.length > 0 && (
              <Select value={filterKat} onValueChange={setFilterKat}>
                <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua kategori</SelectItem>
                  {(data?.kategori ?? []).map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {list.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Receipt className="h-7 w-7" />} title="Belum ada pengeluaran lain"
                desc="Catat pengeluaran non-belanja bulan ini lewat form di atas." />
            </div>
          ) : listTampil.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Tidak ada pengeluaran pada kategori ini.</p>
          ) : (
            <ul className="divide-y">
              {listTampil.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{katNama.get(p.kategori_pengeluaran_id ?? "") ?? "Tanpa kategori"}</span>
                      <span className="font-mono text-xs text-muted-foreground">{formatTanggal(p.tanggal)}</span>
                      {p.metode_bayar && <span className="rounded bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">{p.metode_bayar}</span>}
                      {p.rutin_id && <span className="inline-flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success"><Repeat className="h-3 w-3" /> Rutin</span>}
                      {memberCount > 1 && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {p.user_id === userId ? "oleh Anda" : `oleh ${namaAnggota.get(p.user_id) ?? "anggota"}`}
                        </span>
                      )}
                    </div>
                    {p.deskripsi && <p className="mt-0.5 truncate text-sm">{p.deskripsi}</p>}
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold">{formatRupiah(p.nominal)}</span>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {(p.user_id === userId || isKepala) && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => hapus(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <EditPengeluaranDialog entri={editing} kategori={data?.kategori ?? []}
        onClose={() => setEditing(null)} onSaved={refetch} />
      <RutinDialog entri={editRutin} kategori={data?.kategori ?? []} userId={userId!}
        onClose={() => setEditRutin(null)} onSaved={refetch} />
    </>
  );
}

function EditPengeluaranDialog({ entri, kategori, onClose, onSaved }: {
  entri: PengeluaranLainRow | null;
  kategori: { id: string; nama: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tanggal, setTanggal] = useState("");
  const [kategoriId, setKategoriId] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [nominal, setNominal] = useState("");
  const [metode, setMetode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entri) {
      setTanggal(entri.tanggal);
      setKategoriId(entri.kategori_pengeluaran_id ?? "");
      setDeskripsi(entri.deskripsi ?? "");
      setNominal(String(entri.nominal));
      setMetode(entri.metode_bayar ?? "");
    }
  }, [entri]);

  const simpan = async () => {
    if (!entri) return;
    const n = Number(nominal);
    if (!nominal.trim() || Number.isNaN(n) || n <= 0) { toast.error("Nominal harus lebih dari 0."); return; }
    setSaving(true);
    const { error } = await supabase.from("pengeluaran_lain").update({
      tanggal, kategori_pengeluaran_id: kategoriId || null, deskripsi: deskripsi.trim(), nominal: n, metode_bayar: metode || null,
    }).eq("id", entri.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pengeluaran diperbarui.");
    onClose(); onSaved();
  };

  return (
    <Dialog open={!!entri} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Pengeluaran</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tanggal</Label><Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Nominal (Rp)</Label><Input type="number" inputMode="numeric" value={nominal} onFocus={(e) => e.target.select()} onChange={(e) => setNominal(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select value={kategoriId} onValueChange={setKategoriId}>
              <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>{kategori.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Input value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="mis. GoFood ayam geprek" />
            </div>
            <div className="space-y-1.5">
              <Label>Metode Bayar</Label>
              <Select value={metode} onValueChange={setMetode}>
                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent>{METODE_BAYAR.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">Batal</Button>
          <Button onClick={simpan} disabled={saving} className="flex-1">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RutinDialog({ entri, kategori, userId, onClose, onSaved }: {
  entri: PengeluaranRutinRow | "baru" | null;
  kategori: { id: string; nama: string }[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = entri && entri !== "baru";
  const [kategoriId, setKategoriId] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [nominal, setNominal] = useState("");
  const [tanggalHari, setTanggalHari] = useState("1");
  const [metode, setMetode] = useState("");
  const [aktif, setAktif] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entri === "baru") {
      setKategoriId(""); setDeskripsi(""); setNominal(""); setTanggalHari("1"); setMetode(""); setAktif(true);
    } else if (entri) {
      setKategoriId(entri.kategori_pengeluaran_id ?? "");
      setDeskripsi(entri.deskripsi ?? "");
      setNominal(String(entri.nominal));
      setTanggalHari(String(entri.tanggal_hari));
      setMetode(entri.metode_bayar ?? "");
      setAktif(entri.aktif);
    }
  }, [entri]);

  const simpan = async () => {
    const n = Number(nominal);
    if (!nominal.trim() || Number.isNaN(n) || n <= 0) { toast.error("Nominal harus lebih dari 0."); return; }
    const hari = Math.min(28, Math.max(1, Math.round(Number(tanggalHari) || 1)));
    setSaving(true);
    const payload = {
      kategori_pengeluaran_id: kategoriId || null, deskripsi: deskripsi.trim(),
      nominal: n, tanggal_hari: hari, metode_bayar: metode || null, aktif,
    };
    const { error } = isEdit
      ? await supabase.from("pengeluaran_rutin").update(payload).eq("id", (entri as PengeluaranRutinRow).id)
      : await supabase
          .from("pengeluaran_rutin")
          .insert({ ...payload, user_id: userId, keluarga_id: await getKeluargaId(userId) });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "Pengeluaran rutin diperbarui." : "Pengeluaran rutin ditambahkan.");
    onClose(); onSaved();
  };

  return (
    <Dialog open={!!entri} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Edit Pengeluaran Rutin" : "Tambah Pengeluaran Rutin"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Deskripsi</Label>
            <Input value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="mis. Internet rumah, Netflix" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Nominal (Rp)</Label><Input type="number" inputMode="numeric" value={nominal} onFocus={(e) => e.target.select()} onChange={(e) => setNominal(e.target.value)} placeholder="150000" /></div>
            <div className="space-y-1.5"><Label>Tiap tanggal (1–28)</Label><Input type="number" inputMode="numeric" min={1} max={28} value={tanggalHari} onChange={(e) => setTanggalHari(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={kategoriId} onValueChange={setKategoriId}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>{kategori.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Metode Bayar</Label>
              <Select value={metode} onValueChange={setMetode}>
                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent>{METODE_BAYAR.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={aktif} onCheckedChange={(v) => setAktif(!!v)} /> Aktif (ikut saat "Terapkan bulan ini")
          </label>
        </div>
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">Batal</Button>
          <Button onClick={simpan} disabled={saving} className="flex-1">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
