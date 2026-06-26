import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { getPlans, createTransaction, getMySubscription } from "@/lib/api/subscription.functions";
import { PageHeader } from "@/components/app-shell";
import { Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Check, ArrowLeft, ShieldCheck } from "lucide-react";

type Plan = "plus" | "keluarga";
type Cycle = "bulanan" | "tahunan";

// Ringkasan fitur per paket (selaras dengan landing #harga).
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

export const Route = createFileRoute("/_authenticated/app/langganan/checkout")({
  validateSearch: (s: Record<string, unknown>): { plan: Plan; siklus: Cycle } => ({
    plan: s.plan === "keluarga" ? "keluarga" : "plus",
    siklus: s.siklus === "tahunan" ? "tahunan" : "bulanan",
  }),
  head: () => ({ meta: [{ title: "Pembayaran Langganan — BelanjaKu" }] }),
  component: CheckoutPage,
});

// Memuat snap.js sekali, dengan client key yang benar (sandbox/produksi).
function loadSnap(url: string, clientKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if ((window as unknown as { snap?: unknown }).snap) return resolve();
    const existing = document.getElementById("midtrans-snap") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Gagal memuat Snap.")));
      return;
    }
    const s = document.createElement("script");
    s.id = "midtrans-snap";
    s.src = url;
    s.setAttribute("data-client-key", clientKey);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Gagal memuat Snap."));
    document.body.appendChild(s);
  });
}

interface SnapCallbacks {
  onSuccess?: () => void;
  onPending?: () => void;
  onError?: () => void;
  onClose?: () => void;
}

function CheckoutPage() {
  const { plan, siklus: siklusAwal } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const [siklus, setSiklus] = useState<Cycle>(siklusAwal);
  const [loading, setLoading] = useState(false);

  // Kembali ke layar sebelumnya (mis. Pilih Paket / dashboard / landing).
  // Fallback ke Pilih Paket bila tak ada riwayat (mis. checkout dibuka langsung).
  const kembali = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else navigate({ to: "/app/langganan" });
  };

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["subscription_plans"],
    queryFn: () => getPlans(),
  });
  const { data: sub } = useQuery({
    queryKey: ["my_subscription"],
    queryFn: () => getMySubscription(),
  });

  const planInfo = plans?.find((p) => p.code === plan);
  const harga = planInfo
    ? siklus === "tahunan"
      ? planInfo.harga_tahunan
      : planInfo.harga_bulanan
    : 0;
  const hargaBulananEfektif = siklus === "tahunan" ? Math.round(harga / 12) : harga;

  const planName = (code: string | null) => plans?.find((p) => p.code === code)?.nama ?? code ?? "";
  const sudahAktif = sub?.plan === plan; // sudah langganan paket yang sama
  const punyaPaketLain = !!sub?.plan && sub.plan !== plan; // langganan paket berbeda
  const aktifSampai = sub?.active_until ? formatTanggal(sub.active_until) : null;

  const bayar = async () => {
    setLoading(true);
    try {
      const res = await createTransaction({ data: { plan_code: plan, cycle: siklus } });
      await loadSnap(res.snap_js_url, res.client_key);
      const snap = (window as unknown as { snap: { pay: (t: string, cb: SnapCallbacks) => void } })
        .snap;
      const goStatus = () =>
        navigate({ to: "/app/langganan/status", search: { order_id: res.order_id } });
      snap.pay(res.token, {
        onSuccess: goStatus,
        onPending: goStatus,
        onError: () => {
          toast.error("Pembayaran gagal. Silakan coba lagi.");
          setLoading(false);
        },
        onClose: () => {
          setLoading(false);
          goStatus();
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan.");
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Pembayaran Langganan"
        subtitle="Selesaikan pembayaran untuk membuka fitur premium."
        action={
          <button
            type="button"
            onClick={kembali}
            className="text-sm text-muted-foreground hover:underline"
          >
            <span className="inline-flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </span>
          </button>
        }
      />

      {plansLoading || !planInfo ? (
        <div className="mx-auto max-w-md space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-1 text-sm font-medium text-muted-foreground">Paket dipilih</div>
          <h2 className="text-2xl font-bold">{planInfo.nama}</h2>

          {/* Toggle siklus */}
          <div className="mt-4 inline-flex rounded-lg border p-1 text-sm">
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

          {/* Harga */}
          <div className="mt-5">
            <div className="text-3xl font-extrabold">
              {formatRupiah(hargaBulananEfektif)}
              <span className="text-base font-medium text-muted-foreground">/bln</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {siklus === "tahunan"
                ? `Ditagih ${formatRupiah(harga)} per tahun`
                : "Ditagih bulanan"}
            </div>
          </div>

          {/* Fitur */}
          <ul className="mt-5 space-y-2 text-sm">
            {FITUR[plan].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {/* Info langganan yang sedang aktif */}
          {sudahAktif ? (
            <div className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              Kamu sudah berlangganan {planInfo.nama}
              {aktifSampai ? ` sampai ${aktifSampai}` : ""}. Membayar akan{" "}
              <strong>memperpanjang</strong> masa aktif.
            </div>
          ) : punyaPaketLain ? (
            <div className="mt-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              Kamu sedang berlangganan {planName(sub!.plan)}
              {aktifSampai ? ` sampai ${aktifSampai}` : ""}. Membeli {planInfo.nama} akan menambah
              periode baru.
            </div>
          ) : null}

          {/* Peringatan pembayaran tertunda agar tak membuat order ganda */}
          {sub?.pending ? (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              Ada pembayaran <strong>menunggu</strong> untuk paket {planName(sub.pending.plan_code)}
              .{" "}
              <Link
                to="/app/langganan/status"
                search={{ order_id: sub.pending.order_id }}
                className="font-medium underline"
              >
                Lihat status pembayaran
              </Link>{" "}
              dulu sebelum membayar lagi.
            </div>
          ) : null}

          <Button onClick={bayar} disabled={loading} className="mt-6 w-full" size="lg">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading
              ? "Memproses…"
              : sudahAktif
                ? `Perpanjang — ${formatRupiah(harga)}`
                : `Bayar ${formatRupiah(harga)}`}
          </Button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Pembayaran aman diproses oleh Midtrans.
          </p>
        </div>
      )}
    </div>
  );
}
