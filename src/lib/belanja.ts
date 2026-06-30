import { supabase } from "@/integrations/supabase/client";
import { getKeluargaId } from "@/lib/keluarga";

export interface BelanjaItemRow {
  id: string;
  belanja_id: string;
  user_id: string;
  item_id: string | null;
  nama_snapshot: string;
  merk: string | null;
  kategori_barang_id: string | null;
  jumlah: number;
  satuan: string;
  estimasi_harga: number;
  estimasi_sumber: "histori" | "ai" | "manual" | null;
  harga_aktual: number | null;
  harga_sumber: "scan" | "manual" | null;
  toko_id: string | null;
  sudah_dibeli: boolean;
  dibeli_at: string | null;
  tambahan: boolean;
}

export interface BelanjaBulananRow {
  id: string;
  user_id: string;
  keluarga_id: string;
  bulan: number;
  tahun: number;
  budget: number;
  budget_lain: number;
  status: string;
  created_at: string;
  selesai_at: string | null;
}

/**
 * Get estimated price for an item from the user's latest histori_harga.
 * When `merk` is given, prefer the latest price for that specific brand so
 * different brands of the same item don't overwrite each other's estimate.
 */
export async function getEstimasiHarga(
  userId: string,
  itemId: string | null,
  merk?: string | null,
): Promise<number> {
  if (!itemId) return 0;
  let query = supabase
    .from("histori_harga")
    .select("harga")
    .eq("item_id", itemId)
    .eq("user_id", userId);
  if (merk) query = query.eq("merk", merk);
  const { data } = await query.order("tanggal", { ascending: false }).limit(1);
  if (data && data.length > 0) return Number(data[0].harga);
  // Fallback: if no brand-specific history, use the item's latest price overall.
  if (merk) return getEstimasiHarga(userId, itemId, null);
  return 0;
}

/**
 * Get or create the belanja_bulanan record for the given month.
 * Belanja dimiliki per-KELUARGA: dicari & dibuat berdasarkan keluarga_id user,
 * sehingga seluruh anggota berbagi daftar & budget yang sama.
 */
export async function getOrCreateBelanja(
  userId: string,
  bulan: number,
  tahun: number,
  budget = 0,
): Promise<BelanjaBulananRow> {
  const keluargaId = await getKeluargaId(userId);
  const { data: existing } = await supabase
    .from("belanja_bulanan")
    .select("*")
    .eq("keluarga_id", keluargaId)
    .eq("bulan", bulan)
    .eq("tahun", tahun)
    .maybeSingle();
  if (existing) return existing as BelanjaBulananRow;
  const { data: created, error } = await supabase
    .from("belanja_bulanan")
    .insert({ user_id: userId, keluarga_id: keluargaId, bulan, tahun, budget, status: "draft" })
    .select("*")
    .single();
  if (error) throw error;
  return created as BelanjaBulananRow;
}

// ---- Belanja Tambahan (pembelian susulan, langsung dibeli & masuk stok) ----
export interface BelanjaTambahanInput {
  item_id: string | null;
  nama: string;
  kategori_barang_id?: string | null;
  jumlah: number;
  satuan: string;
  harga: number; // total yang dibayar untuk pembelian ini
  tanggal: string; // ISO (YYYY-MM-DD)
}

/** Daftar pembelian tambahan untuk periode (terbaru dulu). */
export async function getBelanjaTambahan(
  userId: string,
  bulan: number,
  tahun: number,
): Promise<BelanjaItemRow[]> {
  const belanja = await getOrCreateBelanja(userId, bulan, tahun);
  const { data, error } = await supabase
    .from("belanja_item")
    .select("*")
    .eq("belanja_id", belanja.id)
    .eq("tambahan", true)
    .order("dibeli_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BelanjaItemRow[];
}

/**
 * Catat satu pembelian tambahan: ditandai `tambahan` + `sudah_dibeli` sehingga
 * masuk stok (trigger) dan terhitung realisasi/budget bulan ini. Bila item
 * master & ada harga, simpan juga histori_harga (per-satuan) untuk estimasi.
 */
export async function addBelanjaTambahan(
  userId: string,
  bulan: number,
  tahun: number,
  input: BelanjaTambahanInput,
): Promise<void> {
  const belanja = await getOrCreateBelanja(userId, bulan, tahun);
  const dibeliAt = new Date(input.tanggal + "T00:00:00").toISOString();
  const { error } = await supabase.from("belanja_item").insert({
    belanja_id: belanja.id,
    user_id: userId,
    item_id: input.item_id,
    nama_snapshot: input.nama.trim(),
    kategori_barang_id: input.kategori_barang_id ?? null,
    jumlah: input.jumlah,
    satuan: input.satuan,
    estimasi_harga: 0,
    harga_aktual: input.harga,
    harga_sumber: "manual",
    sudah_dibeli: true,
    dibeli_at: dibeliAt,
    tambahan: true,
  });
  if (error) throw error;
  // Histori harga per-satuan (selaras app.selesai) agar estimasi ke depan akurat.
  if (input.item_id && input.harga > 0) {
    await supabase.from("histori_harga").insert({
      item_id: input.item_id,
      user_id: userId,
      harga: Math.round(input.harga / (input.jumlah || 1)),
      tanggal: dibeliAt,
    });
  }
}

export interface BelanjaTambahanPatch {
  jumlah?: number;
  satuan?: string;
  harga?: number;
  tanggal?: string; // ISO (YYYY-MM-DD)
}

/**
 * Ubah pembelian tambahan. Perubahan jumlah/satuan ikut menyesuaikan stok
 * (trigger belanja_item_ke_stok pada UPDATE saat tetap sudah_dibeli); harga
 * memperbarui realisasi/budget.
 */
export async function updateBelanjaTambahan(
  id: string,
  patch: BelanjaTambahanPatch,
): Promise<void> {
  const upd: { jumlah?: number; satuan?: string; harga_aktual?: number; dibeli_at?: string } = {};
  if (patch.jumlah != null) upd.jumlah = patch.jumlah;
  if (patch.satuan != null) upd.satuan = patch.satuan;
  if (patch.harga != null) upd.harga_aktual = patch.harga;
  if (patch.tanggal) upd.dibeli_at = new Date(patch.tanggal + "T00:00:00").toISOString();
  if (Object.keys(upd).length === 0) return;
  const { error } = await supabase.from("belanja_item").update(upd).eq("id", id);
  if (error) throw error;
}

export async function deleteBelanjaTambahan(id: string): Promise<void> {
  const { error } = await supabase.from("belanja_item").delete().eq("id", id);
  if (error) throw error;
}

export function totalEstimasi(items: BelanjaItemRow[]): number {
  return items.reduce((s, i) => s + Number(i.estimasi_harga) * Number(i.jumlah), 0);
}

export function totalRealisasi(items: BelanjaItemRow[]): number {
  return items
    .filter((i) => i.sudah_dibeli && i.harga_aktual != null)
    .reduce((s, i) => s + Number(i.harga_aktual), 0);
}

export function budgetStatus(pemakaian: number, budget: number): "success" | "warning" | "danger" {
  if (budget <= 0) return "success";
  const ratio = pemakaian / budget;
  if (ratio > 1) return "danger";
  if (ratio >= 0.8) return "warning";
  return "success";
}
