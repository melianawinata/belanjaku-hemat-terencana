import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileData {
  id: string;
  nama: string;
  email: string | null;
  kategori_user_id: string | null;
  foto_url: string | null;
  kategori_user?: { nama: string } | null;
}

async function fetchSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function fetchProfileAndRole(userId: string) {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nama, email, kategori_user_id, foto_url, kategori_user:kategori_user_id(nama)")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  return { profile: profile as ProfileData | null, isAdmin };
}

export function useAuth() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queryClient.invalidateQueries({ queryKey: ["session"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const sessionQuery = useQuery({ queryKey: ["session"], queryFn: fetchSession });
  const userId = sessionQuery.data?.user?.id;

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfileAndRole(userId!),
    enabled: !!userId,
  });

  return {
    session: sessionQuery.data,
    userId,
    profile: profileQuery.data?.profile ?? null,
    isAdmin: profileQuery.data?.isAdmin ?? false,
    loading: sessionQuery.isLoading || (!!userId && profileQuery.isLoading),
  };
}

/**
 * Validasi path tujuan redirect setelah login. Hanya mengizinkan path
 * internal relatif (mencegah open-redirect ke domain lain) dan menolak
 * kembali ke /auth (mencegah loop). Mengembalikan path aman atau null.
 */
export function safeInternalPath(p: string | null | undefined): string | null {
  if (!p) return null;
  if (!p.startsWith("/")) return null; // wajib relatif
  if (p.startsWith("//")) return null; // protocol-relative -> eksternal
  if (p.startsWith("/auth")) return null; // hindari loop ke halaman auth
  return p;
}

export async function logActivity(userId: string, tipe: string, deskripsi: string) {
  await supabase.from("aktivitas").insert({ user_id: userId, tipe, deskripsi });
}

/**
 * Menentukan tujuan navigasi setelah autentikasi (email maupun Google).
 * Satu sumber kebenaran agar konsisten dipakai di /auth dan /auth/callback.
 *
 * - Profil belum lengkap (kategori_user_id NULL, mis. user baru via Google)
 *   -> halaman Lengkapi Profil.
 * - Admin -> dashboard admin.
 * - Selain itu -> dashboard aplikasi.
 */
export async function routeAfterAuth(
  userId: string,
): Promise<"/lengkapi-profil" | "/admin/dashboard" | "/app/dashboard"> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("kategori_user_id").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!profile?.kategori_user_id) return "/lengkapi-profil";
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  return isAdmin ? "/admin/dashboard" : "/app/dashboard";
}
