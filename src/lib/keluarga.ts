import { supabase } from "@/integrations/supabase/client";

export type PeranKeluarga = "kepala" | "anggota";

export interface KeluargaRow {
  id: string;
  nama: string;
  kode_undangan: string;
  created_by: string | null;
  created_at: string;
}

export interface AnggotaKeluarga {
  user_id: string;
  peran: PeranKeluarga;
  nama: string;
  email: string | null;
  foto_url: string | null;
  created_at: string;
}

/**
 * keluarga_id milik user. Setiap user tergabung di tepat satu keluarga
 * (otomatis dibuat saat signup), jadi ini selalu ada untuk user valid.
 * Dipakai untuk menyaring data belanja & pengeluaran per-keluarga.
 */
export async function getKeluargaId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("keluarga_anggota")
    .select("keluarga_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Keluarga tidak ditemukan untuk akun ini.");
  return data.keluarga_id;
}
