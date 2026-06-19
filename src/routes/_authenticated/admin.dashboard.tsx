import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin-shell";
import { StatCard, Skeleton } from "@/components/belanja-ui";
import { namaBulan } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard Admin — BelanjaKu" }] }),
  component: AdminDashboard,
});

const CHART = ["#16A34A", "#2563EB", "#38BDF8", "#D97706", "#9333EA"];

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin_dashboard"],
    queryFn: async () => {
      const [{ count: totalUser }, { count: totalItem }, { count: totalToko }, { data: belanja }, { data: profiles }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("item").select("*", { count: "exact", head: true }),
        supabase.from("toko").select("*", { count: "exact", head: true }),
        supabase.from("belanja_bulanan").select("bulan, tahun, user_id, created_at"),
        supabase.from("profiles").select("kategori_user_id, kategori_user:kategori_user_id(nama), created_at"),
      ]);
      const totalDaftar = (belanja ?? []).length;
      const rataDaftar = (totalUser ?? 0) > 0 ? totalDaftar / (totalUser ?? 1) : 0;

      // user per kategori
      const katMap = new Map<string, number>();
      (profiles ?? []).forEach((p) => {
        const nama = (p.kategori_user as { nama: string } | null)?.nama ?? "Lainnya";
        katMap.set(nama, (katMap.get(nama) ?? 0) + 1);
      });
      const pieData = [...katMap.entries()].map(([name, value]) => ({ name, value }));

      // user growth per month
      const grow = new Map<string, number>();
      (profiles ?? []).forEach((p) => {
        const d = new Date(p.created_at as string);
        const key = `${namaBulan(d.getMonth() + 1).slice(0, 3)}`;
        grow.set(key, (grow.get(key) ?? 0) + 1);
      });
      const growthData = [...grow.entries()].map(([label, user]) => ({ label, user }));

      return { totalUser: totalUser ?? 0, totalItem: totalItem ?? 0, totalToko: totalToko ?? 0, totalDaftar, rataDaftar, pieData, growthData };
    },
  });

  if (isLoading) return (<><AdminHeader title="Dashboard Admin" /><div className="grid gap-4 sm:grid-cols-3">{[0,1,2].map(i=><Skeleton key={i} className="h-28" />)}</div></>);

  return (
    <>
      <AdminHeader title="Dashboard Admin" subtitle="Ringkasan platform BelanjaKu" />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total User" value={data?.totalUser ?? 0} tone="info" />
          <StatCard label="Total Daftar Belanja" value={data?.totalDaftar ?? 0} tone="success" />
          <StatCard label="Rata-rata Daftar/User" value={(data?.rataDaftar ?? 0).toFixed(1)} />
          <StatCard label="Total Item Master" value={data?.totalItem ?? 0} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Distribusi User per Kategori</p>
            {(data?.pieData ?? []).length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Belum ada user.</p> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data?.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {(data?.pieData ?? []).map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Pertumbuhan User per Bulan</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.growthData ?? []}>
                <XAxis dataKey="label" fontSize={12} /><YAxis allowDecimals={false} fontSize={11} width={28} /><Tooltip />
                <Bar dataKey="user" name="User Baru" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
