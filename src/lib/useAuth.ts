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

export async function logActivity(userId: string, tipe: string, deskripsi: string) {
  await supabase.from("aktivitas").insert({ user_id: userId, tipe, deskripsi });
}
