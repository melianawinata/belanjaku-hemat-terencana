import { supabase } from "@/integrations/supabase/client";
import { getKeluargaId } from "@/lib/keluarga";
import { getOrCreateBelanja, getEstimasiHarga } from "@/lib/belanja";

export type SlotMakan = "pagi" | "siang" | "sore";
export const SLOTS: { key: SlotMakan; label: string }[] = [
  { key: "pagi", label: "Pagi" },
  { key: "siang", label: "Siang" },
  { key: "sore", label: "Sore" },
];

export type TipeKomponen = "belanja" | "pengeluaran";

export interface MenuKomponenRow {
  id: string;
  menu_id: string;
  tipe: TipeKomponen;
  item_id: string | null;
  kategori_barang_id: string | null;
  nama: string;
  jumlah: number;
  satuan: string;
  perkiraan_biaya: number;
  kategori_pengeluaran_id: string | null;
}

export interface MenuMasakanRow {
  id: string;
  keluarga_id: string;
  user_id: string;
  nama: string;
  catatan: string | null;
  created_at: string;
}

export interface RencanaMakanRow {
  id: string;
  tanggal: string; // YYYY-MM-DD
  slot: SlotMakan;
  menu_id: string;
  porsi: number;
  dibelanjakan_at: string | null;
}

// ---- Tanggal util (minggu Senin–Minggu, lokal) --------------------------
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function awalMinggu(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Senin
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function tambahHari(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

// ---- Resep / Menu --------------------------------------------------------
export async function getMenuList(userId: string): Promise<MenuMasakanRow[]> {
  const keluargaId = await getKeluargaId(userId);
  const { data } = await supabase
    .from("menu_masakan")
    .select("*")
    .eq("keluarga_id", keluargaId)
    .order("nama");
  return (data ?? []) as MenuMasakanRow[];
}

export async function getKomponen(menuIds: string[]): Promise<MenuKomponenRow[]> {
  if (menuIds.length === 0) return [];
  const { data } = await supabase
    .from("menu_komponen")
    .select("*")
    .in("menu_id", menuIds)
    .order("created_at");
  return (data ?? []) as MenuKomponenRow[];
}

export async function createMenu(userId: string, nama: string, catatan?: string): Promise<string> {
  const keluargaId = await getKeluargaId(userId);
  const { data, error } = await supabase
    .from("menu_masakan")
    .insert({ user_id: userId, keluarga_id: keluargaId, nama, catatan: catatan || null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteMenu(id: string): Promise<void> {
  const { error } = await supabase.from("menu_masakan").delete().eq("id", id);
  if (error) throw error;
}

export async function addKomponen(
  menuId: string,
  k: Omit<MenuKomponenRow, "id" | "menu_id">,
): Promise<void> {
  const { error } = await supabase.from("menu_komponen").insert({ menu_id: menuId, ...k });
  if (error) throw error;
}

export async function deleteKomponen(id: string): Promise<void> {
  const { error } = await supabase.from("menu_komponen").delete().eq("id", id);
  if (error) throw error;
}

// ---- Rencana makan -------------------------------------------------------
export async function getRencana(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<RencanaMakanRow[]> {
  const keluargaId = await getKeluargaId(userId);
  const { data } = await supabase
    .from("rencana_makan")
    .select("id, tanggal, slot, menu_id, porsi, dibelanjakan_at")
    .eq("keluarga_id", keluargaId)
    .gte("tanggal", startISO)
    .lte("tanggal", endISO)
    .order("tanggal");
  return (data ?? []) as RencanaMakanRow[];
}

export async function addRencana(
  userId: string,
  tanggal: string,
  slot: SlotMakan,
  menuId: string,
  porsi = 1,
): Promise<void> {
  const keluargaId = await getKeluargaId(userId);
  const { error } = await supabase.from("rencana_makan").insert({
    user_id: userId,
    keluarga_id: keluargaId,
    tanggal,
    slot,
    menu_id: menuId,
    porsi,
  });
  if (error) throw error;
}

export async function deleteRencana(id: string): Promise<void> {
  const { error } = await supabase.from("rencana_makan").delete().eq("id", id);
  if (error) throw error;
}

export interface GenerateResult {
  belanja: number; // jumlah baris belanja ditambah/digabung
  pengeluaran: number; // jumlah entri pengeluaran lain dibuat
  dilewati: number; // rencana yang sudah pernah dibelanjakan
}

/**
 * Ubah rencana makan pada rentang [startISO, endISO] menjadi:
 *   - komponen 'belanja'     -> belanja_item periode aktif (bulan/tahun), digabung
 *     dengan item yang sudah ada (anti-dobel).
 *   - komponen 'pengeluaran' -> pengeluaran_lain (tanggal = tanggal rencana).
 * Idempoten: hanya memproses rencana yang belum ditandai dibelanjakan_at.
 */
export async function generateDariMenu(
  userId: string,
  startISO: string,
  endISO: string,
  bulan: number,
  tahun: number,
): Promise<GenerateResult> {
  const keluargaId = await getKeluargaId(userId);
  const semua = await getRencana(userId, startISO, endISO);
  const rencana = semua.filter((r) => !r.dibelanjakan_at);
  const dilewati = semua.length - rencana.length;
  if (rencana.length === 0) return { belanja: 0, pengeluaran: 0, dilewati };

  const komponen = await getKomponen([...new Set(rencana.map((r) => r.menu_id))]);
  const kompByMenu = new Map<string, MenuKomponenRow[]>();
  for (const k of komponen) {
    if (!kompByMenu.has(k.menu_id)) kompByMenu.set(k.menu_id, []);
    kompByMenu.get(k.menu_id)!.push(k);
  }

  // Agregasi komponen belanja per (item/nama, satuan).
  interface Agg {
    item_id: string | null;
    nama: string;
    kategori_barang_id: string | null;
    satuan: string;
    jumlah: number;
  }
  const belanjaAgg = new Map<string, Agg>();
  const pengeluaranRows: {
    tanggal: string;
    nominal: number;
    deskripsi: string;
    kategori_pengeluaran_id: string | null;
  }[] = [];

  for (const r of rencana) {
    for (const k of kompByMenu.get(r.menu_id) ?? []) {
      if (k.tipe === "belanja") {
        const key = `${k.item_id ?? "free:" + k.nama.trim().toLowerCase()}|${k.satuan}`;
        const cur = belanjaAgg.get(key);
        const tambah = Number(k.jumlah) * Number(r.porsi);
        if (cur) cur.jumlah += tambah;
        else
          belanjaAgg.set(key, {
            item_id: k.item_id,
            nama: k.nama,
            kategori_barang_id: k.kategori_barang_id,
            satuan: k.satuan,
            jumlah: tambah,
          });
      } else {
        const nominal = Number(k.perkiraan_biaya) * Number(r.porsi);
        if (nominal > 0)
          pengeluaranRows.push({
            tanggal: r.tanggal,
            nominal,
            deskripsi: k.nama,
            kategori_pengeluaran_id: k.kategori_pengeluaran_id,
          });
      }
    }
  }

  // --- Belanja: gabung ke belanja_item periode aktif ---
  let belanjaCount = 0;
  if (belanjaAgg.size > 0) {
    const belanja = await getOrCreateBelanja(userId, bulan, tahun);
    const { data: existing } = await supabase
      .from("belanja_item")
      .select("id, item_id, nama_snapshot, satuan, jumlah")
      .eq("belanja_id", belanja.id);
    const existingRows = existing ?? [];

    for (const agg of belanjaAgg.values()) {
      const match = existingRows.find(
        (e) =>
          e.satuan === agg.satuan &&
          (agg.item_id
            ? e.item_id === agg.item_id
            : (e.nama_snapshot ?? "").trim().toLowerCase() === agg.nama.trim().toLowerCase()),
      );
      if (match) {
        await supabase
          .from("belanja_item")
          .update({ jumlah: Number(match.jumlah) + agg.jumlah })
          .eq("id", match.id);
      } else {
        const estimasi = agg.item_id ? await getEstimasiHarga(userId, agg.item_id) : 0;
        await supabase.from("belanja_item").insert({
          belanja_id: belanja.id,
          user_id: userId,
          item_id: agg.item_id,
          nama_snapshot: agg.nama,
          kategori_barang_id: agg.kategori_barang_id,
          jumlah: agg.jumlah,
          satuan: agg.satuan,
          estimasi_harga: estimasi,
          estimasi_sumber: estimasi > 0 ? "histori" : null,
        });
      }
      belanjaCount++;
    }
  }

  // --- Pengeluaran lain ---
  if (pengeluaranRows.length > 0) {
    const { error } = await supabase
      .from("pengeluaran_lain")
      .insert(pengeluaranRows.map((p) => ({ ...p, user_id: userId, keluarga_id: keluargaId })));
    if (error) throw error;
  }

  // Tandai rencana sudah dibelanjakan (idempoten).
  await supabase
    .from("rencana_makan")
    .update({ dibelanjakan_at: new Date().toISOString() })
    .in(
      "id",
      rencana.map((r) => r.id),
    );

  return { belanja: belanjaCount, pengeluaran: pengeluaranRows.length, dilewati };
}
