import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { getKeluargaDetail, type KeluargaDetail } from "@/lib/api/keluarga.functions";

/**
 * Detail keluarga user yang sedang login: anggota, peran, status gating paket.
 * Dipakai untuk halaman Keluarga, atribusi "ditambahkan oleh", dan gating UI.
 */
export function useKeluarga() {
  const { userId } = useAuth();
  const q = useQuery({
    queryKey: ["keluarga-detail", userId],
    enabled: !!userId,
    queryFn: () => getKeluargaDetail(),
  });
  const detail: KeluargaDetail | null = q.data ?? null;
  return {
    detail,
    anggota: detail?.anggota ?? [],
    isKepala: detail?.is_kepala ?? false,
    memberCount: detail?.member_count ?? 1,
    canInvite: detail?.can_invite ?? false,
    // Paket aktif kepala keluarga; null = belum berlangganan.
    kepalaPlan: detail?.kepala_plan ?? null,
    // Akses fitur berbayar keluarga (mis. menu makan): kepala berlangganan paket apa pun.
    berlangganan: (detail?.kepala_plan ?? null) !== null,
    loading: q.isLoading,
    refetch: q.refetch,
  };
}
