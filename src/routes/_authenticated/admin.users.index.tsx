import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin-shell";
import { EmptyState, Skeleton } from "@/components/belanja-ui";
import { Input } from "@/components/ui/input";
import { formatTanggal } from "@/lib/format";
import { Search, ChevronRight, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users/")({
  head: () => ({ meta: [{ title: "Daftar User — Admin BelanjaKu" }] }),
  component: UsersPage,
});

function UsersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles").select("id, nama, email, created_at, kategori_user:kategori_user_id(nama)").order("created_at", { ascending: false });
      const result = [];
      for (const p of profiles ?? []) {
        const { count } = await supabase.from("belanja_bulanan").select("*", { count: "exact", head: true }).eq("user_id", p.id);
        result.push({ ...p, jumlahDaftar: count ?? 0 });
      }
      return result;
    },
  });

  if (isLoading) return (<><AdminHeader title="Daftar User" /><div className="space-y-2">{[0,1,2].map(i=><Skeleton key={i} className="h-16" />)}</div></>);
  const rows = (data ?? []).filter((p) => !search || String(p.nama).toLowerCase().includes(search.toLowerCase()) || String(p.email).toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <AdminHeader title="Daftar User" subtitle="Kelola dan pantau pengguna" />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / email..." className="pl-9" />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title="Belum ada user" desc="User akan muncul di sini setelah mendaftar." />
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <Link key={p.id} to="/admin/users/$id" params={{ id: p.id }} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm hover:bg-muted/40">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-info/15 font-mono text-sm font-semibold text-info">{String(p.nama || "?").charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{String(p.nama)}</p>
                <p className="truncate text-xs text-muted-foreground">{String(p.email)} · {(p.kategori_user as { nama: string } | null)?.nama ?? "-"}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="font-mono text-sm">{p.jumlahDaftar} daftar</p>
                <p className="text-xs text-muted-foreground">{formatTanggal(p.created_at as string)}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
