import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server functions untuk fitur Keluarga (berbagi belanja antar akun).
//
// Prinsip:
//   * Perubahan keanggotaan SELALU lewat sini (service_role) agar invariant
//     "satu user = satu keluarga" & gating paket terjaga; client tak menulis
//     langsung ke keluarga_anggota.
//   * Gating: menambah anggota ke-2+ butuh KEPALA punya paket 'keluarga' aktif
//     (get_active_plan). Anggota yang diundang ikut gratis.

const MAX_ANGGOTA = 5;

export interface AnggotaInfo {
  user_id: string;
  peran: "kepala" | "anggota";
  nama: string;
  email: string | null;
  foto_url: string | null;
}

export interface KeluargaDetail {
  keluarga: { id: string; nama: string; kode_undangan: string };
  anggota: AnggotaInfo[];
  my_peran: "kepala" | "anggota";
  is_kepala: boolean;
  member_count: number;
  // Paket aktif kepala keluarga; menentukan apakah boleh mengundang anggota.
  kepala_plan: string | null;
  can_invite: boolean;
}

function kodeBaru(): string {
  return `${Math.random().toString(36).slice(2, 6)}${Math.random().toString(36).slice(2, 6)}`
    .toUpperCase()
    .slice(0, 8);
}

function getAdmin() {
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
}

// Ambil keluarga_id + peran user. Lempar bila tak ada (seharusnya selalu ada).
async function myMembership(admin: Awaited<ReturnType<typeof getAdmin>>, userId: string) {
  const { data } = await admin
    .from("keluarga_anggota")
    .select("keluarga_id, peran")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Keluarga tidak ditemukan untuk akun ini.");
  return data as { keluarga_id: string; peran: "kepala" | "anggota" };
}

async function buildDetail(userId: string): Promise<KeluargaDetail> {
  const admin = await getAdmin();
  const me = await myMembership(admin, userId);

  const [{ data: kel }, { data: anggotaRows }] = await Promise.all([
    admin.from("keluarga").select("id, nama, kode_undangan").eq("id", me.keluarga_id).single(),
    admin
      .from("keluarga_anggota")
      .select("user_id, peran")
      .eq("keluarga_id", me.keluarga_id)
      .order("created_at"),
  ]);

  const ids = (anggotaRows ?? []).map((a) => a.user_id);
  const { data: profil } = await admin
    .from("profiles")
    .select("id, nama, email, foto_url")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const profMap = new Map((profil ?? []).map((p) => [p.id, p]));

  const anggota: AnggotaInfo[] = (anggotaRows ?? []).map((a) => {
    const p = profMap.get(a.user_id);
    return {
      user_id: a.user_id,
      peran: a.peran as "kepala" | "anggota",
      nama: p?.nama || "Anggota",
      email: p?.email ?? null,
      foto_url: p?.foto_url ?? null,
    };
  });

  const kepalaId = anggota.find((a) => a.peran === "kepala")?.user_id ?? null;
  let kepalaPlan: string | null = null;
  if (kepalaId) {
    const { data: plan } = await admin.rpc("get_active_plan", { _user: kepalaId });
    kepalaPlan = (plan as string | null) ?? null;
  }

  return {
    keluarga: { id: kel!.id, nama: kel!.nama, kode_undangan: kel!.kode_undangan },
    anggota,
    my_peran: me.peran,
    is_kepala: me.peran === "kepala",
    member_count: anggota.length,
    kepala_plan: kepalaPlan,
    can_invite: me.peran === "kepala" && kepalaPlan === "keluarga",
  };
}

// ---- getKeluargaDetail: info keluarga + anggota + status gating ----------
export const getKeluargaDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KeluargaDetail> => {
    return buildDetail(context.userId as string);
  });

// ---- gantiNama: kepala mengubah nama keluarga ----------------------------
const namaInput = z.object({ nama: z.string().trim().min(1).max(60) });

export const gantiNamaKeluarga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(namaInput)
  .handler(async ({ data, context }): Promise<KeluargaDetail> => {
    const userId = context.userId as string;
    const admin = await getAdmin();
    const me = await myMembership(admin, userId);
    if (me.peran !== "kepala") throw new Error("Hanya kepala keluarga yang boleh mengubah nama.");
    const { error } = await admin
      .from("keluarga")
      .update({ nama: data.nama })
      .eq("id", me.keluarga_id);
    if (error) throw new Error(error.message);
    return buildDetail(userId);
  });

// ---- generateKode: kepala memutar ulang kode undangan --------------------
export const generateKode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ kode: string }> => {
    const userId = context.userId as string;
    const admin = await getAdmin();
    const me = await myMembership(admin, userId);
    if (me.peran !== "kepala") throw new Error("Hanya kepala keluarga yang boleh mengubah kode.");
    // Coba beberapa kali kalau-kalau kode bentrok (UNIQUE).
    for (let i = 0; i < 5; i++) {
      const kode = kodeBaru();
      const { error } = await admin
        .from("keluarga")
        .update({ kode_undangan: kode })
        .eq("id", me.keluarga_id);
      if (!error) return { kode };
    }
    throw new Error("Gagal membuat kode baru, coba lagi.");
  });

// ---- gabungViaKode: user bergabung ke keluarga lain via kode --------------
const kodeInput = z.object({ kode: z.string().trim().min(4).max(20) });

export const gabungViaKode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(kodeInput)
  .handler(async ({ data, context }): Promise<KeluargaDetail> => {
    const userId = context.userId as string;
    const admin = await getAdmin();
    const kode = data.kode.toUpperCase();

    const { data: target } = await admin
      .from("keluarga")
      .select("id")
      .eq("kode_undangan", kode)
      .maybeSingle();
    if (!target) throw new Error("Kode keluarga tidak ditemukan.");

    const me = await myMembership(admin, userId);
    if (me.keluarga_id === target.id) throw new Error("Anda sudah berada di keluarga ini.");

    // Tidak boleh meninggalkan keluarga yang Anda pimpin bila masih ada anggota lain.
    const { count: myFamCount } = await admin
      .from("keluarga_anggota")
      .select("user_id", { count: "exact", head: true })
      .eq("keluarga_id", me.keluarga_id);
    if (me.peran === "kepala" && (myFamCount ?? 1) > 1) {
      throw new Error(
        "Anda kepala keluarga dengan anggota lain. Keluarkan/alihkan anggota dulu sebelum bergabung ke keluarga lain.",
      );
    }

    // Gating: kepala keluarga tujuan harus punya paket 'keluarga' aktif.
    const { data: kepalaRow } = await admin
      .from("keluarga_anggota")
      .select("user_id")
      .eq("keluarga_id", target.id)
      .eq("peran", "kepala")
      .maybeSingle();
    const { data: plan } = kepalaRow
      ? await admin.rpc("get_active_plan", { _user: kepalaRow.user_id })
      : { data: null };
    if (plan !== "keluarga") {
      throw new Error("Kepala keluarga tujuan belum berlangganan paket Keluarga.");
    }

    // Batas anggota.
    const { count: targetCount } = await admin
      .from("keluarga_anggota")
      .select("user_id", { count: "exact", head: true })
      .eq("keluarga_id", target.id);
    if ((targetCount ?? 0) >= MAX_ANGGOTA) {
      throw new Error(`Keluarga sudah penuh (maks ${MAX_ANGGOTA} anggota).`);
    }

    // Pindahkan keanggotaan (keluarga lama dibiarkan — data lama tak dihapus).
    const { error } = await admin
      .from("keluarga_anggota")
      .update({ keluarga_id: target.id, peran: "anggota" })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return buildDetail(userId);
  });

// ---- keluarDariKeluarga: keluar & kembali ke keluarga sendiri -------------
async function pindahKeKeluargaBaru(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  userId: string,
): Promise<void> {
  const { data: prof } = await admin.from("profiles").select("nama").eq("id", userId).maybeSingle();
  const nama = prof?.nama?.trim() || "Saya";
  let kid: string | null = null;
  for (let i = 0; i < 5; i++) {
    const { data: created, error } = await admin
      .from("keluarga")
      .insert({ nama: `Keluarga ${nama}`, kode_undangan: kodeBaru(), created_by: userId })
      .select("id")
      .single();
    if (!error && created) {
      kid = created.id;
      break;
    }
  }
  if (!kid) throw new Error("Gagal membuat keluarga baru.");
  const { error: upErr } = await admin
    .from("keluarga_anggota")
    .update({ keluarga_id: kid, peran: "kepala" })
    .eq("user_id", userId);
  if (upErr) throw new Error(upErr.message);
}

export const keluarDariKeluarga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KeluargaDetail> => {
    const userId = context.userId as string;
    const admin = await getAdmin();
    const me = await myMembership(admin, userId);

    const { count } = await admin
      .from("keluarga_anggota")
      .select("user_id", { count: "exact", head: true })
      .eq("keluarga_id", me.keluarga_id);
    if (me.peran === "kepala" && (count ?? 1) > 1) {
      throw new Error("Anda kepala keluarga dengan anggota lain. Keluarkan anggota dulu.");
    }
    if ((count ?? 1) <= 1) {
      // Sudah sendirian — tak ada yang perlu ditinggalkan.
      return buildDetail(userId);
    }
    await pindahKeKeluargaBaru(admin, userId);
    return buildDetail(userId);
  });

// ---- keluarkanAnggota: kepala mengeluarkan anggota -----------------------
const targetInput = z.object({ user_id: z.string().uuid() });

export const keluarkanAnggota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(targetInput)
  .handler(async ({ data, context }): Promise<KeluargaDetail> => {
    const userId = context.userId as string;
    const admin = await getAdmin();
    const me = await myMembership(admin, userId);
    if (me.peran !== "kepala")
      throw new Error("Hanya kepala keluarga yang boleh mengeluarkan anggota.");
    if (data.user_id === userId)
      throw new Error("Gunakan menu keluar untuk meninggalkan keluarga.");

    const { data: target } = await admin
      .from("keluarga_anggota")
      .select("keluarga_id")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!target || target.keluarga_id !== me.keluarga_id) {
      throw new Error("Anggota tidak ditemukan di keluarga Anda.");
    }

    await pindahKeKeluargaBaru(admin, data.user_id);
    return buildDetail(userId);
  });
