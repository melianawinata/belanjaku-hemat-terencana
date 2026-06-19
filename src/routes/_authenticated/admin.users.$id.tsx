import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin-shell";
import { Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatRupiah, formatTanggalWaktu, labelBulanTahun } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  head: () => ({ meta: [{ title: "Detail User — Admin BelanjaKu" }] }),
  component: UserDetail,
});

function UserDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["admin_user_detail", id],
    queryFn: async () => {
      const [{ data: profile }, { data: belanja }, { data: aktivitas }] = await Promise.all([
        supabase.from("profiles").select("id, nama, email, created_at, kategori_user:kategori_user_id(nama)").eq("id", id).maybeSingle(),
        supabase.from("belanja_bulanan").select("*").eq("user_id", id).order("tahun", { ascending: false }).order("bulan", { ascending: false }),
        supabase.from("aktivitas").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
      ]);
      return { profile, belanja: belanja ?? [], aktivitas: aktivitas ?? [] };
    },
  });

  if (isLoading) return (<><AdminHeader title="Detail User" /><Skeleton className="h-40" /></>);
  const p = data?.profile;

  return (
    <>
      <AdminHeader title={p ? String(p.nama) : "Detail User"} subtitle={p?.email ? String(p.email) : ""} action={
        <Link to="/admin/users"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Button></Link>
      } />
      <Tabs defaultValue="profil">
        <TabsList>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="history">History Belanja</TabsTrigger>
          <TabsTrigger value="aktivitas">Aktivitas</TabsTrigger>
        </TabsList>
        <TabsContent value="profil" className="mt-4">
          <div className="max-w-md space-y-3 rounded-2xl border bg-card p-5 shadow-sm text-sm">
            <Row label="Nama" value={String(p?.nama ?? "-")} />
            <Row label="Email" value={String(p?.email ?? "-")} />
            <Row label="Kategori" value={(p?.kategori_user as { nama: string } | null)?.nama ?? "-"} />
            <Row label="Bergabung" value={formatTanggalWaktu(p?.created_at as string)} />
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <ul className="divide-y">
              {(data?.belanja ?? []).map((b) => (
                <li key={b.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium">{labelBulanTahun(b.bulan, b.tahun)}</span>
                  <span className="font-mono text-xs text-muted-foreground">budget {formatRupiah(b.budget)} · {b.status}</span>
                </li>
              ))}
              {(data?.belanja ?? []).length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada belanja.</li>}
            </ul>
          </div>
        </TabsContent>
        <TabsContent value="aktivitas" className="mt-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <ul className="divide-y">
              {(data?.aktivitas ?? []).map((a) => (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <p>{a.deskripsi}</p>
                  <p className="font-mono text-xs text-muted-foreground">{formatTanggalWaktu(a.created_at)}</p>
                </li>
              ))}
              {(data?.aktivitas ?? []).length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada aktivitas.</li>}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
