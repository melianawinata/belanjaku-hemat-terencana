import { supabase } from "@/integrations/supabase/client";
import { getKeluargaId } from "@/lib/keluarga";

export interface KategoriPengeluaranRow {
  id: string;
  nama: string;
  urutan: number;
  created_at: string;
}

export interface PengeluaranLainRow {
  id: string;
  user_id: string;
  keluarga_id: string;
  tanggal: string; // YYYY-MM-DD
  kategori_pengeluaran_id: string | null;
  deskripsi: string;
  nominal: number;
  metode_bayar: string | null;
  rutin_id: string | null;
  created_at: string;
}

export interface PengeluaranRutinRow {
  id: string;
  user_id: string;
  keluarga_id: string;
  kategori_pengeluaran_id: string | null;
  deskripsi: string;
  nominal: number;
  tanggal_hari: number; // 1-28
  metode_bayar: string | null;
  aktif: boolean;
  created_at: string;
}

/** Metode pembayaran yang tersedia (set tetap, tidak dikelola admin). */
export const METODE_BAYAR = ["Tunai", "Transfer", "E-Wallet", "Kartu Kredit", "QRIS", "Lainnya"] as const;

/** First & last calendar day of a month as YYYY-MM-DD (local). */
export function rentangBulan(bulan: number, tahun: number): { mulai: string; akhir: string } {
  const mm = String(bulan).padStart(2, "0");
  const akhirHari = new Date(tahun, bulan, 0).getDate(); // day 0 of next month = last day this month
  return { mulai: `${tahun}-${mm}-01`, akhir: `${tahun}-${mm}-${String(akhirHari).padStart(2, "0")}` };
}

/** Today as YYYY-MM-DD (local) — for the catat-pengeluaran form default. */
export function tanggalHariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getKategoriPengeluaran(): Promise<KategoriPengeluaranRow[]> {
  const { data } = await supabase
    .from("kategori_pengeluaran")
    .select("*")
    .order("urutan")
    .order("nama");
  return (data ?? []) as KategoriPengeluaranRow[];
}

export async function getPengeluaranLain(userId: string, bulan: number, tahun: number): Promise<PengeluaranLainRow[]> {
  const keluargaId = await getKeluargaId(userId);
  const { mulai, akhir } = rentangBulan(bulan, tahun);
  const { data } = await supabase
    .from("pengeluaran_lain")
    .select("*")
    .eq("keluarga_id", keluargaId)
    .gte("tanggal", mulai)
    .lte("tanggal", akhir)
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as PengeluaranLainRow[];
}

export function totalPengeluaran(rows: PengeluaranLainRow[]): number {
  return rows.reduce((s, r) => s + Number(r.nominal), 0);
}

/** Sum nominal per kategori_pengeluaran_id (null grouped under "lain"). */
export function pengeluaranPerKategori(rows: PengeluaranLainRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const key = r.kategori_pengeluaran_id ?? "lain";
    m.set(key, (m.get(key) ?? 0) + Number(r.nominal));
  }
  return m;
}

export async function getPengeluaranRutin(userId: string): Promise<PengeluaranRutinRow[]> {
  const keluargaId = await getKeluargaId(userId);
  const { data } = await supabase
    .from("pengeluaran_rutin")
    .select("*")
    .eq("keluarga_id", keluargaId)
    .order("created_at");
  return (data ?? []) as PengeluaranRutinRow[];
}

/**
 * Materialisasi template rutin yang aktif ke pengeluaran_lain untuk bulan tertentu.
 * Idempoten per (rutin_id, bulan): template yang sudah punya entri di bulan itu dilewati.
 * Mengembalikan jumlah entri yang baru dibuat.
 */
export async function generateRutinBulanIni(userId: string, bulan: number, tahun: number): Promise<number> {
  const keluargaId = await getKeluargaId(userId);
  const rutin = (await getPengeluaranRutin(userId)).filter((r) => r.aktif);
  if (rutin.length === 0) return 0;

  const { mulai, akhir } = rentangBulan(bulan, tahun);
  const { data: existing } = await supabase
    .from("pengeluaran_lain")
    .select("rutin_id")
    .eq("keluarga_id", keluargaId)
    .gte("tanggal", mulai)
    .lte("tanggal", akhir)
    .not("rutin_id", "is", null);
  const sudahAda = new Set((existing ?? []).map((e) => e.rutin_id));

  const mm = String(bulan).padStart(2, "0");
  const rows = rutin
    .filter((r) => !sudahAda.has(r.id))
    .map((r) => ({
      user_id: userId,
      keluarga_id: keluargaId,
      tanggal: `${tahun}-${mm}-${String(r.tanggal_hari).padStart(2, "0")}`,
      kategori_pengeluaran_id: r.kategori_pengeluaran_id,
      deskripsi: r.deskripsi,
      nominal: r.nominal,
      metode_bayar: r.metode_bayar,
      rutin_id: r.id,
    }));
  if (rows.length === 0) return 0;

  const { error } = await supabase.from("pengeluaran_lain").insert(rows);
  if (error) throw error;
  return rows.length;
}

export interface TrenBulan { label: string; budget: number; terpakai: number }

/** Tren pengeluaran lain (budget_lain vs terpakai) untuk `jumlahBulan` bulan terakhir s/d bulan ini. */
export async function getTrenPengeluaran(userId: string, bulan: number, tahun: number, jumlahBulan = 6): Promise<TrenBulan[]> {
  const keluargaId = await getKeluargaId(userId);
  // Daftar bulan target, dari yang terlama ke bulan ini.
  const target: { bulan: number; tahun: number }[] = [];
  let b = bulan, t = tahun;
  for (let i = 0; i < jumlahBulan; i++) {
    target.unshift({ bulan: b, tahun: t });
    b -= 1; if (b === 0) { b = 12; t -= 1; }
  }
  const awal = target[0];
  const { mulai } = rentangBulan(awal.bulan, awal.tahun);
  const { akhir } = rentangBulan(bulan, tahun);

  const { data: rows } = await supabase
    .from("pengeluaran_lain").select("tanggal, nominal")
    .eq("keluarga_id", keluargaId).gte("tanggal", mulai).lte("tanggal", akhir);
  const { data: belanja } = await supabase
    .from("belanja_bulanan").select("bulan, tahun, budget_lain").eq("keluarga_id", keluargaId);

  const NAMA = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const budgetMap = new Map((belanja ?? []).map((x) => [`${x.tahun}-${x.bulan}`, Number(x.budget_lain)]));
  const pakaiMap = new Map<string, number>();
  for (const r of rows ?? []) {
    const d = new Date(r.tanggal);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    pakaiMap.set(key, (pakaiMap.get(key) ?? 0) + Number(r.nominal));
  }
  return target.map((m) => ({
    label: NAMA[m.bulan - 1],
    budget: budgetMap.get(`${m.tahun}-${m.bulan}`) ?? 0,
    terpakai: pakaiMap.get(`${m.tahun}-${m.bulan}`) ?? 0,
  }));
}
