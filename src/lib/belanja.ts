import { supabase } from "@/integrations/supabase/client";

export interface BelanjaItemRow {
  id: string;
  belanja_id: string;
  item_id: string | null;
  nama_snapshot: string;
  merk: string | null;
  kategori_barang_id: string | null;
  jumlah: number;
  satuan: string;
  estimasi_harga: number;
  harga_aktual: number | null;
  toko_id: string | null;
  sudah_dibeli: boolean;
  dibeli_at: string | null;
}

export interface BelanjaBulananRow {
  id: string;
  user_id: string;
  bulan: number;
  tahun: number;
  budget: number;
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

/** Get or create the belanja_bulanan record for the given month. */
export async function getOrCreateBelanja(
  userId: string,
  bulan: number,
  tahun: number,
  budget = 0,
): Promise<BelanjaBulananRow> {
  const { data: existing } = await supabase
    .from("belanja_bulanan")
    .select("*")
    .eq("user_id", userId)
    .eq("bulan", bulan)
    .eq("tahun", tahun)
    .maybeSingle();
  if (existing) return existing as BelanjaBulananRow;
  const { data: created, error } = await supabase
    .from("belanja_bulanan")
    .insert({ user_id: userId, bulan, tahun, budget, status: "draft" })
    .select("*")
    .single();
  if (error) throw error;
  return created as BelanjaBulananRow;
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
