import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/format";
import { getPlans, getMySubscription } from "@/lib/api/subscription.functions";
import { PageHeader } from "@/components/app-shell";
import { Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Check, Crown } from "lucide-react";

type Plan = "plus" | "keluarga";
type Cycle = "bulanan" | "tahunan";

const FITUR: Record<Plan, string[]> = {
  plus: [
    "Semua fitur Gratis",
    "Manajemen stok rumah lengkap",
    "Pengingat stok habis",
    "Laporan pengeluaran detail",
    "Sinkronisasi multi-perangkat",
  ],
  keluarga: [
    "Semua fitur Plus",
    "Kolaborasi real-time keluarga",
    "Prediksi stok berbasis AI",
    "Barcode scanner",
    "Integrasi promo & perbandingan harga",
  ],
};

const POPULER: Record<string, boolean> = { plus: true };

export const Route = createFileRoute("/_authenticated/app/langganan/")({
  head: () => ({ meta: [{ title: "Pilih Paket — BelanjaKu" }] }),
  component: PilihPaketPage,
});

function PilihPaketPage() {
  const [siklus, setSiklus] = useState<Cycle>("bulanan");

  const { data: plans, isLoading } = useQuery({
    queryKey: ["subscription_plans"],
    queryFn: () => getPlans(),
  });
  const { data: sub } = useQuery({
    queryKey: ["my_subscription"],
    queryFn: () => getMySubscription(),
  });

  return (
    <div>
      <PageHeader
        title="Pilih Paket"
        subtitle="Tingkatkan saat butuh lebih. Bisa berhenti kapan saja."
      />

      {/* Toggle siklus */}
      <div className="mb-6 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-lg border p-1 text-sm">
          {(["bulanan", "tahunan"] as Cycle[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSiklus(c)}
              className={
                "rounded-md px-3 py-1.5 transition " +
                (siklus === c ? "bg-primary text-primary-foreground" : "text-muted-foreground")
              }
            >
              {c === "bulanan" ? "Bulanan" : "Tahunan"}
              {c === "tahunan" ? <span className="ml-1 text-xs">hemat 20%</span> : null}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !plans ? (
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          {plans.map((p) => {
            const harga = siklus === "tahunan" ? p.harga_tahunan : p.harga_bulanan;
            const perBulan = siklus === "tahunan" ? Math.round(harga / 12) : harga;
            const populer = POPULER[p.code];
            const iniPaketSaya = sub?.plan === p.code;
            return (
              <div
                key={p.code}
                className={
                  "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm " +
                  (populer ? "border-primary ring-1 ring-primary/20" : "")
                }
              >
                {populer ? (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    Paling Populer
                  </span>
                ) : null}
                {iniPaketSaya ? (
                  <span className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-semibold text-white">
                    <Crown className="h-3 w-3" /> Paket kamu
                  </span>
                ) : null}

                <h3 className="text-xl font-bold">{p.nama}</h3>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold">{formatRupiah(perBulan)}</span>
                  <span className="text-sm font-medium text-muted-foreground">/bln</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {siklus === "tahunan"
                    ? `Ditagih ${formatRupiah(harga)} per tahun`
                    : "Ditagih bulanan"}
                </p>

                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {(FITUR[p.code as Plan] ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild className="mt-6 w-full" variant={populer ? "default" : "outline"}>
                  <Link to="/app/langganan/checkout" search={{ plan: p.code as Plan, siklus }}>
                    {iniPaketSaya ? "Perpanjang" : `Pilih ${p.nama}`}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Bisa berhenti kapan saja, tanpa kontrak.
      </p>
    </div>
  );
}
