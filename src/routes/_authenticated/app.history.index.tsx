import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { formatRupiah, labelBulanTahun } from "@/lib/format";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { History, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/history/")({
  head: () => ({ meta: [{ title: "History Belanja — BelanjaKu" }] }),
  component: HistoryPage,
});

const STATUS_LABEL: Record<string, { t: string; c: string }> = {
  draft: { t: "Draft", c: "bg-muted text-muted-foreground" },
  belanja: { t: "Belanja", c: "bg-info/10 text-info" },
  selesai: { t: "Selesai", c: "bg-success/10 text-success" },
};

function HistoryPage() {
  const { userId } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: belanja } = await supabase.from("belanja_bulanan").select("*")
        .eq("user_id", userId!).order("tahun", { ascending: false }).order("bulan", { ascending: false });
      const result = [];
      for (const b of belanja ?? []) {
        const { data: items } = await supabase.from("belanja_item").select("harga_aktual, sudah_dibeli").eq("belanja_id", b.id);
        const total = (items ?? []).filter((x) => x.sudah_dibeli && x.harga_aktual != null).reduce((s, x) => s + Number(x.harga_aktual), 0);
        result.push({ ...b, total, jumlahItem: (items ?? []).length });
      }
      return result;
    },
  });

  if (isLoading) return (<><PageHeader title="History Belanja" /><div className="space-y-2">{[0,1,2].map(i=><Skeleton key={i} className="h-20" />)}</div></>);

  const rows = data ?? [];

  return (
    <>
      <PageHeader title="History Belanja" subtitle="Catatan belanja bulananmu" />
      {rows.length === 0 ? (
        <EmptyState icon={<History className="h-7 w-7" />} title="Belum ada history"
          desc="Selesaikan belanja bulan ini, nanti ringkasannya muncul di sini."
          action={<Link to="/app/belanja"><Button>Susun Daftar</Button></Link>} />
      ) : (
        <div className="space-y-2">
          {rows.map((b) => {
            const s = STATUS_LABEL[b.status] ?? STATUS_LABEL.draft;
            return (
              <Link key={b.id} to="/app/history/$id" params={{ id: b.id }}
                className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{labelBulanTahun(b.bulan, b.tahun)}</p>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${s.c}`}>{s.t}</span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{b.jumlahItem} item · budget {formatRupiah(b.budget)}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold">{formatRupiah(b.total)}</p>
                  <p className="text-xs text-muted-foreground">pengeluaran</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
