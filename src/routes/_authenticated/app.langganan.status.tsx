import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatRupiah } from "@/lib/format";
import { getOrderStatus, cancelTransaction } from "@/lib/api/subscription.functions";
import { PageHeader } from "@/components/app-shell";
import { Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/langganan/status")({
  validateSearch: (s: Record<string, unknown>): { order_id: string } => ({
    order_id: typeof s.order_id === "string" ? s.order_id : "",
  }),
  head: () => ({ meta: [{ title: "Status Pembayaran — BelanjaKu" }] }),
  component: StatusPage,
});

function StatusPage() {
  const { order_id } = Route.useSearch();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["order_status", order_id],
    queryFn: () => getOrderStatus({ data: { order_id } }),
    enabled: !!order_id,
    // Selama masih pending, polling tiap 4 detik menunggu webhook.
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 4000 : false),
  });

  // Batalkan order pending lalu kembali ke checkout untuk coba metode lain.
  const batalkan = async () => {
    if (!data) return;
    setCancelling(true);
    try {
      await cancelTransaction({ data: { order_id } });
      toast.success("Pembayaran dibatalkan. Silakan coba lagi.");
      navigate({
        to: "/app/langganan/checkout",
        search: {
          plan: data.plan_code as "plus" | "keluarga",
          siklus: data.cycle as "bulanan" | "tahunan",
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membatalkan.");
      setCancelling(false);
    }
  };

  return (
    <div>
      <PageHeader title="Status Pembayaran" subtitle="Status langganan diperbarui otomatis." />

      <div className="mx-auto max-w-md">
        {!order_id ? (
          <Card tone="muted">
            <p className="text-sm text-muted-foreground">Order tidak diketahui.</p>
            <BackBtn />
          </Card>
        ) : isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !data ? (
          <Card tone="muted">
            <p className="text-sm text-muted-foreground">Transaksi tidak ditemukan.</p>
            <BackBtn />
          </Card>
        ) : data.status === "paid" ? (
          <Card tone="success">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h2 className="mt-3 text-xl font-bold">Pembayaran Berhasil</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Langganan {data.plan_code} kamu sudah aktif. Selamat menikmati fitur premium!
            </p>
            <Button asChild className="mt-5 w-full">
              <Link to="/app/dashboard">Ke Dashboard</Link>
            </Button>
          </Card>
        ) : data.status === "pending" ? (
          <Card tone="warning">
            <Clock className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="mt-3 text-xl font-bold">Menunggu Pembayaran</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selesaikan pembayaran sebesar <strong>{formatRupiah(data.gross_amount)}</strong>{" "}
              sesuai instruksi yang diberikan. Halaman ini akan diperbarui otomatis begitu
              pembayaran kami terima.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Memeriksa status…
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isRefetching || cancelling}
              className="mt-4 w-full"
            >
              {isRefetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cek status sekarang
            </Button>
            <Button
              variant="ghost"
              onClick={batalkan}
              disabled={cancelling}
              className="mt-2 w-full text-muted-foreground"
            >
              {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Batalkan & ganti metode
            </Button>
          </Card>
        ) : (
          <Card tone="error">
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-3 text-xl font-bold">
              {data.status === "expired" ? "Pembayaran Kedaluwarsa" : "Pembayaran Gagal"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.status === "expired"
                ? "Batas waktu pembayaran telah lewat. Silakan ulangi."
                : "Transaksi tidak selesai. Kamu bisa mencoba lagi."}
            </p>
            <Button asChild className="mt-5 w-full">
              <Link
                to="/app/langganan/checkout"
                search={{
                  plan: data.plan_code as "plus" | "keluarga",
                  siklus: data.cycle as "bulanan" | "tahunan",
                }}
              >
                Coba Lagi
              </Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "muted" | "success" | "warning" | "error";
}) {
  const border =
    tone === "success"
      ? "border-emerald-200"
      : tone === "warning"
        ? "border-amber-200"
        : tone === "error"
          ? "border-red-200"
          : "";
  return (
    <div className={`rounded-2xl border bg-card p-6 text-center shadow-sm ${border}`}>
      {children}
    </div>
  );
}

function BackBtn() {
  return (
    <Button asChild variant="outline" className="mt-4 w-full">
      <Link to="/app/dashboard">Ke Dashboard</Link>
    </Button>
  );
}
