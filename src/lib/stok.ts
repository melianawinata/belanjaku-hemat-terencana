import { supabase } from "@/integrations/supabase/client";
import { getKeluargaId } from "@/lib/keluarga";
import { getEstimasiHarga } from "@/lib/belanja";

export type TipeMutasi = "masuk" | "keluar" | "koreksi";
export type SumberMutasi = "manual" | "belanja" | "menu";

export interface StokBarangRow {
  id: string;
  keluarga_id: string;
  user_id: string;
  item_id: string | null;
  nama: string;
  kategori_barang_id: string | null;
  jumlah: number;
  satuan: string;
  jumlah_minimum: number | null;
  lokasi: string | null;
  tanggal_expired: string | null; // YYYY-MM-DD
  catatan: string | null;
  item_key: string;
  updated_at: string;
}

export interface StokMutasiRow {
  id: string;
  item_id: string | null;
  nama: string;
  tipe: TipeMutasi;
  jumlah: number;
  satuan: string;
  sumber: SumberMutasi;
  catatan: string | null;
  created_at: string;
}

/**
 * Kunci identitas barang — harus sama dgn kolom GENERATED `item_key` di DB.
 * Item master: pakai item_id (semua satuan mengrecup ke satu baris, dikonversi).
 * Item bebas: nama + satuan (telur-bebas-butir & telur-bebas-kg jadi 2 baris).
 */
export function itemKey(itemId: string | null, nama: string, satuan: string): string {
  return itemId ?? `free:${nama.trim().toLowerCase()}|${satuan.trim().toLowerCase()}`;
}

/** True jika saldo di bawah/sama dengan ambang minimum yang diset user. */
export function stokRendah(s: StokBarangRow): boolean {
  return s.jumlah_minimum != null && Number(s.jumlah) <= Number(s.jumlah_minimum);
}

/** Saran jumlah beli untuk mengembalikan stok ke minimum (min. 1 satuan). */
export function saranJumlah(s: StokBarangRow): number {
  const kurang = Number(s.jumlah_minimum ?? 0) - Number(s.jumlah);
  return kurang > 0 ? kurang : Number(s.jumlah_minimum ?? 1) || 1;
}

/** Status kedaluwarsa: 'expired' (lewat), 'soon' (<= hari), atau null. */
export function statusExpired(s: StokBarangRow, soonDays = 7): "expired" | "soon" | null {
  if (!s.tanggal_expired) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(s.tanggal_expired + "T00:00:00");
  const beda = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
  if (beda < 0) return "expired";
  if (beda <= soonDays) return "soon";
  return null;
}

// ---- Saldo ----------------------------------------------------------------
export async function getStokList(userId: string): Promise<StokBarangRow[]> {
  const keluargaId = await getKeluargaId(userId);
  const { data, error } = await supabase
    .from("stok_barang")
    .select("*")
    .eq("keluarga_id", keluargaId)
    .order("nama");
  if (error) throw error;
  return (data ?? []) as StokBarangRow[];
}

// ---- Mutasi (buku besar) --------------------------------------------------
export interface MutasiInput {
  item_id: string | null;
  nama: string;
  kategori_barang_id?: string | null;
  tipe: TipeMutasi;
  jumlah: number; // selalu kirim positif (kecuali koreksi yang boleh +/-)
  satuan: string;
  catatan?: string | null;
}

/** Catat satu pergerakan stok manual. Saldo di-update otomatis oleh trigger DB. */
export async function catatMutasi(userId: string, m: MutasiInput): Promise<void> {
  const keluargaId = await getKeluargaId(userId);
  const { error } = await supabase.from("stok_mutasi").insert({
    keluarga_id: keluargaId,
    user_id: userId,
    item_id: m.item_id,
    nama: m.nama.trim(),
    kategori_barang_id: m.kategori_barang_id ?? null,
    tipe: m.tipe,
    jumlah: m.jumlah,
    satuan: m.satuan,
    sumber: "manual",
    catatan: m.catatan ?? null,
  });
  if (error) throw error;
}

/** Riwayat pergerakan untuk satu barang (kartu stok), terbaru dulu. */
export async function getMutasi(userId: string, key: string): Promise<StokMutasiRow[]> {
  const keluargaId = await getKeluargaId(userId);
  const { data, error } = await supabase
    .from("stok_mutasi")
    .select("id, item_id, nama, tipe, jumlah, satuan, sumber, catatan, created_at")
    .eq("keluarga_id", keluargaId)
    .eq("item_key", key)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StokMutasiRow[];
}

export async function deleteMutasi(id: string): Promise<void> {
  const { error } = await supabase.from("stok_mutasi").delete().eq("id", id);
  if (error) throw error;
}

// ---- Tambah barang + stok awal (mutasi masuk + metadata opsional) ----------
export interface TambahStokInput extends MutasiInput {
  lokasi?: string | null;
  jumlah_minimum?: number | null;
  tanggal_expired?: string | null;
}

export async function tambahStok(userId: string, input: TambahStokInput): Promise<void> {
  await catatMutasi(userId, input);
  const meta: StokMetaPatch = {};
  if (input.lokasi) meta.lokasi = input.lokasi;
  if (input.jumlah_minimum != null) meta.jumlah_minimum = input.jumlah_minimum;
  if (input.tanggal_expired) meta.tanggal_expired = input.tanggal_expired;
  if (Object.keys(meta).length === 0) return;
  const keluargaId = await getKeluargaId(userId);
  const { error } = await supabase
    .from("stok_barang")
    .update(meta)
    .eq("keluarga_id", keluargaId)
    .eq("item_key", itemKey(input.item_id, input.nama, input.satuan));
  if (error) throw error;
}

// ---- Konversi satuan (per keluarga, untuk item master) --------------------
export interface KonversiRow {
  id: string;
  item_id: string;
  satuan: string;
  faktor: number; // 1 <satuan> = faktor <satuan_default item>
  tampilan: boolean; // satuan ini dipakai untuk menampilkan saldo stok
}

/** Daftar konversi yang dipunyai keluarga untuk satu item master. */
export async function getKonversi(userId: string, itemId: string): Promise<KonversiRow[]> {
  const keluargaId = await getKeluargaId(userId);
  const { data, error } = await supabase
    .from("item_konversi")
    .select("id, item_id, satuan, faktor, tampilan")
    .eq("keluarga_id", keluargaId)
    .eq("item_id", itemId)
    .order("satuan");
  if (error) throw error;
  return (data ?? []) as KonversiRow[];
}

/**
 * Tambah/ubah konversi 1 <satuan> = faktor <satuan dasar item>.
 * Konversi PERTAMA untuk sebuah item otomatis jadi satuan tampilan.
 */
export async function addKonversi(
  userId: string,
  itemId: string,
  satuan: string,
  faktor: number,
): Promise<void> {
  const keluargaId = await getKeluargaId(userId);
  const { error } = await supabase
    .from("item_konversi")
    .upsert(
      { keluarga_id: keluargaId, user_id: userId, item_id: itemId, satuan: satuan.trim(), faktor },
      { onConflict: "keluarga_id,item_id,satuan" },
    );
  if (error) throw error;
  // Auto-jadikan satuan tampilan bila item belum punya.
  const { data: adaTampilan } = await supabase
    .from("item_konversi")
    .select("id")
    .eq("keluarga_id", keluargaId)
    .eq("item_id", itemId)
    .eq("tampilan", true)
    .limit(1);
  if (!adaTampilan || adaTampilan.length === 0) {
    await supabase
      .from("item_konversi")
      .update({ tampilan: true })
      .eq("keluarga_id", keluargaId)
      .eq("item_id", itemId)
      .eq("satuan", satuan.trim());
  }
}

/** Set satu konversi sebagai satuan tampilan (yang lain dimatikan dulu). */
export async function setSatuanTampilan(
  userId: string,
  itemId: string,
  konversiId: string,
): Promise<void> {
  const keluargaId = await getKeluargaId(userId);
  // Matikan dulu semua (unique index melarang dua tampilan), lalu set satu.
  const { error: e1 } = await supabase
    .from("item_konversi")
    .update({ tampilan: false })
    .eq("keluarga_id", keluargaId)
    .eq("item_id", itemId);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("item_konversi")
    .update({ tampilan: true })
    .eq("id", konversiId);
  if (e2) throw e2;
}

export async function deleteKonversi(id: string): Promise<void> {
  const { error } = await supabase.from("item_konversi").delete().eq("id", id);
  if (error) throw error;
}

// ---- Satuan tampilan stok (saldo disimpan dalam satuan dasar) -------------
export interface SatuanTampilan {
  satuan: string;
  faktor: number; // 1 <satuan> = faktor <satuan dasar>
}

/** Peta item_id -> satuan tampilan keluarga (untuk menampilkan saldo stok). */
export async function getSatuanTampilanMap(userId: string): Promise<Map<string, SatuanTampilan>> {
  const keluargaId = await getKeluargaId(userId);
  const { data, error } = await supabase
    .from("item_konversi")
    .select("item_id, satuan, faktor")
    .eq("keluarga_id", keluargaId)
    .eq("tampilan", true);
  if (error) throw error;
  const map = new Map<string, SatuanTampilan>();
  for (const r of data ?? []) map.set(r.item_id, { satuan: r.satuan, faktor: Number(r.faktor) });
  return map;
}

/** Saldo (satuan dasar) -> nilai dalam satuan tampilan. */
export function keTampilan(jumlahDasar: number, t?: SatuanTampilan | null): number {
  return t ? jumlahDasar / t.faktor : jumlahDasar;
}

/** Nilai dalam satuan tampilan -> satuan dasar. */
export function dariTampilan(nilai: number, t?: SatuanTampilan | null): number {
  return t ? nilai * t.faktor : nilai;
}

// ---- Metadata stok (jangan ubah `jumlah` di sini; itu milik trigger) -------
export interface StokMetaPatch {
  jumlah_minimum?: number | null;
  lokasi?: string | null;
  tanggal_expired?: string | null;
  satuan?: string;
  catatan?: string | null;
}

export async function updateStokMeta(id: string, patch: StokMetaPatch): Promise<void> {
  const { error } = await supabase.from("stok_barang").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Tambahkan barang stok rendah ke daftar belanja periode aktif (saran isi ulang).
 * Estimasi harga diambil dari histori_harga bila barang punya master item.
 */
export async function tambahKeBelanja(
  userId: string,
  belanjaId: string,
  stok: StokBarangRow,
  jumlah: number,
): Promise<void> {
  const estimasi = stok.item_id ? await getEstimasiHarga(userId, stok.item_id) : 0;
  const { error } = await supabase.from("belanja_item").insert({
    belanja_id: belanjaId,
    user_id: userId,
    item_id: stok.item_id,
    nama_snapshot: stok.nama,
    kategori_barang_id: stok.kategori_barang_id,
    jumlah,
    satuan: stok.satuan,
    estimasi_harga: estimasi,
    estimasi_sumber: estimasi > 0 ? "histori" : null,
  });
  if (error) throw error;
}

/**
 * Hapus barang dari stok sepenuhnya: buang seluruh mutasinya (riwayat) lalu
 * baris saldo. Mutasi dihapus dulu agar tak "hidup lagi" lewat trigger.
 */
export async function hapusBarang(userId: string, stok: StokBarangRow): Promise<void> {
  const keluargaId = await getKeluargaId(userId);
  const { error: e1 } = await supabase
    .from("stok_mutasi")
    .delete()
    .eq("keluarga_id", keluargaId)
    .eq("item_key", stok.item_key);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("stok_barang").delete().eq("id", stok.id);
  if (e2) throw e2;
}
