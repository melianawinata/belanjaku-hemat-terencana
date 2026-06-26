import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { bulanIni, formatRupiah, formatTanggal, namaBulan } from "@/lib/format";
import { totalEstimasi, totalRealisasi, BelanjaItemRow } from "@/lib/belanja";
import { getPengeluaranLain, getPengeluaranRutin, totalPengeluaran } from "@/lib/pengeluaran";
import { getMySubscription } from "@/lib/api/subscription.functions";
import { PageHeader } from "@/components/app-shell";
import { StatCard, BudgetBar, EmptyState, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Wallet,
  Calculator,
  Receipt,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Repeat,
  ShoppingCart,
  ListPlus,
  Crown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — BelanjaKu" }] }),
  component: Dashboard,
});

const CHART = ["#16A34A", "#2563EB", "#38BDF8", "#D97706", "#9333EA", "#DC2626"];

const PLAN_LABEL: Record<string, string> = { plus: "Plus", keluarga: "Keluarga" };

// Kartu status langganan: paket aktif + masa berlaku + jalan cepat upgrade/perpanjang.
function LanggananCard() {
  const { data: sub } = useQuery({
    queryKey: ["my_subscription"],
    queryFn: () => getMySubscription(),
  });
  const aktif = !!sub?.plan;
  const label = aktif ? (PLAN_LABEL[sub!.plan!] ?? sub!.plan) : "Gratis";
  const until = sub?.active_until ? formatTanggal(sub.active_until) : null;
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${aktif ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Paket {label}</p>
            <p className="text-xs text-muted-foreground">
              {aktif ? `Aktif sampai ${until}` : "Fitur dasar, gratis selamanya"}
            </p>
          </div>
        </div>
        {aktif ? (
          <Link
            to="/app/langganan/checkout"
            search={{
              plan: sub!.plan as "plus" | "keluarga",
              siklus: (sub?.cycle as "bulanan" | "tahunan") ?? "bulanan",
            }}
          >
            <Button variant="outline" size="sm">
              Perpanjang
            </Button>
          </Link>
        ) : (
          <Link to="/app/langganan">
            <Button size="sm">Lihat Paket</Button>
          </Link>
        )}
      </div>
      {sub?.pending ? (
        <div className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
          Ada pembayaran menunggu.{" "}
          <Link
            to="/app/langganan/status"
            search={{ order_id: sub.pending.order_id }}
            className="font-medium underline"
          >
            Lihat status
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Dashboard() {
  const { userId } = useAuth();
  const { bulan, tahun } = bulanIni();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", userId, bulan, tahun],
    enabled: !!userId,
    queryFn: async () => {
      const { data: belanja } = await supabase
        .from("belanja_bulanan")
        .select("*")
        .eq("user_id", userId!)
        .eq("bulan", bulan)
        .eq("tahun", tahun)
        .maybeSingle();

      let items: BelanjaItemRow[] = [];
      if (belanja) {
        const { data: it } = await supabase
          .from("belanja_item")
          .select("*")
          .eq("belanja_id", belanja.id);
        items = (it ?? []) as BelanjaItemRow[];
      }

      const pengeluaranLain = await getPengeluaranLain(userId!, bulan, tahun);
      const rutin = await getPengeluaranRutin(userId!);

      const { data: kategoriBarang } = await supabase.from("kategori_barang").select("id, nama");
      const { data: allBelanja } = await supabase
        .from("belanja_bulanan")
        .select("*")
        .eq("user_id", userId!)
        .order("tahun")
        .order("bulan");
      const { data: histori } = await supabase
        .from("histori_harga")
        .select("harga, tanggal, item_id, merk, item:item_id(nama)")
        .eq("user_id", userId!)
        .order("tanggal", { ascending: false });

      // per-month aggregates (realisasi) from all selesai belanja
      const monthAgg: { label: string; realisasi: number; budget: number }[] = [];
      for (const b of allBelanja ?? []) {
        const { data: bi } = await supabase
          .from("belanja_item")
          .select("harga_aktual, sudah_dibeli")
          .eq("belanja_id", b.id);
        const real = (bi ?? [])
          .filter((x) => x.sudah_dibeli && x.harga_aktual != null)
          .reduce((s, x) => s + Number(x.harga_aktual), 0);
        monthAgg.push({
          label: namaBulan(b.bulan).slice(0, 3),
          realisasi: real,
          budget: Number(b.budget),
        });
      }

      return {
        belanja,
        items,
        pengeluaranLain,
        rutin,
        kategoriBarang: kategoriBarang ?? [],
        histori: histori ?? [],
        monthAgg: monthAgg.slice(-6),
      };
    },
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Ringkasan belanja bulananmu" />
        <div className="mb-6">
          <LanggananCard />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </>
    );
  }

  const budget = Number(data?.belanja?.budget ?? 0);
  const budgetLain = Number(data?.belanja?.budget_lain ?? 0);
  const items = data?.items ?? [];
  const estimasi = totalEstimasi(items);
  const realisasi = totalRealisasi(items);
  const pengeluaranLainTotal = totalPengeluaran(data?.pengeluaranLain ?? []);
  // Pengeluaran rutin aktif yang BELUM diterapkan bulan ini = perkiraan yang masih akan terjadi.
  const rutinApplied = new Set(
    (data?.pengeluaranLain ?? []).map((p) => p.rutin_id).filter(Boolean),
  );
  const estimasiRutin = (data?.rutin ?? [])
    .filter((r) => r.aktif && !rutinApplied.has(r.id))
    .reduce((s, r) => s + Number(r.nominal), 0);
  const estimasiTotal = estimasi + estimasiRutin;
  const pemakaian = realisasi > 0 ? realisasi : estimasi;
  // Ringkasan atas menggabungkan belanja + pengeluaran lain (rincian terpisah ada di bar di bawah).
  const totalBudget = budget + budgetLain;
  const realisasiTotal = realisasi + pengeluaranLainTotal;
  const totalPemakaian = pemakaian + pengeluaranLainTotal;
  const selisih = totalBudget - totalPemakaian;
  const dibeli = items.filter((i) => i.sudah_dibeli).length;
  const belum = items.length - dibeli;

  // category spending (estimasi*jumlah grouped)
  const katMap = new Map<string, number>();
  items.forEach((i) => {
    const kid = i.kategori_barang_id ?? "lain";
    katMap.set(kid, (katMap.get(kid) ?? 0) + Number(i.estimasi_harga) * Number(i.jumlah));
  });
  const katNama = new Map((data?.kategoriBarang ?? []).map((k) => [k.id, k.nama]));
  const pieData = [...katMap.entries()]
    .map(([k, v]) => ({ name: katNama.get(k) ?? "Lainnya", value: v }))
    .filter((d) => d.value > 0);

  // insights: price up/down — compared per item + merk so different brands
  // of the same item aren't compared against each other.
  const latestByItem = new Map<string, { nama: string; harga: number; prev?: number }>();
  for (const h of data?.histori ?? []) {
    const merk = (h as { merk: string | null }).merk;
    const key = `${h.item_id}__${merk ?? ""}`;
    const baseNama = (h.item as { nama: string } | null)?.nama ?? "Item";
    const nama = merk ? `${baseNama} (${merk})` : baseNama;
    if (!latestByItem.has(key)) latestByItem.set(key, { nama, harga: Number(h.harga) });
    else {
      const e = latestByItem.get(key)!;
      if (e.prev === undefined) e.prev = Number(h.harga);
    }
  }
  const deltas = [...latestByItem.values()]
    .filter((e) => e.prev !== undefined && e.prev !== e.harga)
    .map((e) => ({ nama: e.nama, delta: ((e.harga - e.prev!) / e.prev!) * 100 }));
  const naik = deltas
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  const turun = deltas
    .filter((d) => d.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  // most frequent
  const freq = new Map<string, number>();
  for (const h of data?.histori ?? []) {
    const nama = (h.item as { nama: string } | null)?.nama ?? "Item";
    freq.set(nama, (freq.get(nama) ?? 0) + 1);
  }
  const sering = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const selisihTone =
    selisih < 0
      ? "danger"
      : totalBudget > 0 && totalPemakaian / totalBudget >= 0.8
        ? "warning"
        : "success";

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Ringkasan belanja ${namaBulan(bulan)} ${tahun}`}
        action={
          <div className="flex gap-2">
            <Link to="/app/belanja">
              <Button variant="outline">
                <ListPlus className="mr-2 h-4 w-4" /> Susun Daftar
              </Button>
            </Link>
            <Link to="/app/belanja">
              <Button>
                <ShoppingCart className="mr-2 h-4 w-4" /> Mulai Belanja
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6">
        <LanggananCard />
      </div>

      {items.length === 0 && budget === 0 && budgetLain === 0 && pengeluaranLainTotal === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-7 w-7" />}
          title="Belum ada aktivitas bulan ini"
          desc="Yuk atur budget dan susun daftar belanja bulananmu agar pengeluaran lebih terkontrol."
          action={
            <Link to="/app/belanja">
              <Button>Susun Daftar Belanja</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Ringkasan */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Budget Bulan Ini"
              value={formatRupiah(totalBudget)}
              hint={`Belanja ${formatRupiah(budget)} · Lain ${formatRupiah(budgetLain)}`}
              icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              label="Estimasi Belanja"
              value={formatRupiah(estimasiTotal)}
              tone="info"
              hint={`Belanja ${formatRupiah(estimasi)} · Rutin ${formatRupiah(estimasiRutin)}`}
              icon={<Calculator className="h-4 w-4 text-info" />}
            />
            <StatCard
              label="Realisasi"
              value={formatRupiah(realisasiTotal)}
              tone="success"
              hint={`Belanja ${formatRupiah(realisasi)} · Lain ${formatRupiah(pengeluaranLainTotal)}`}
              icon={<Receipt className="h-4 w-4 text-success" />}
            />
            <StatCard
              label="Selisih Budget"
              value={formatRupiah(selisih)}
              tone={selisihTone}
              hint={selisih >= 0 ? "Masih ada sisa, mantap!" : "Melebihi budget"}
              icon={<PiggyBank className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Belanja vs Budget</p>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatRupiah(pemakaian)} / {formatRupiah(budget)}
                </span>
              </div>
              <BudgetBar pemakaian={pemakaian} budget={budget} />
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Pengeluaran Lain vs Budget</p>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatRupiah(pengeluaranLainTotal)} / {formatRupiah(budgetLain)}
                </span>
              </div>
              <BudgetBar pemakaian={pengeluaranLainTotal} budget={budgetLain} />
            </div>
          </div>

          {/* Statistik */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Item Bulan Ini" value={items.length} />
            <StatCard label="Sudah Dibeli" value={dibeli} tone="success" />
            <StatCard label="Belum Dibeli" value={belum} tone="warning" />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold">Pengeluaran per Kategori</p>
              {pieData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Belum ada data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART[i % CHART.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatRupiah(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold">Budget vs Realisasi per Bulan</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.monthAgg ?? []}>
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis tickFormatter={(v) => `${v / 1000}k`} fontSize={11} width={36} />
                  <Tooltip formatter={(v: number) => formatRupiah(v)} />
                  <Legend />
                  <Bar dataKey="budget" name="Budget" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realisasi" name="Realisasi" fill="#16A34A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Insight */}
          <div className="grid gap-4 lg:grid-cols-3">
            <InsightCard
              title="Barang Naik Harga"
              icon={<TrendingUp className="h-4 w-4 text-destructive" />}
              rows={naik.map((d) => ({
                nama: d.nama,
                badge: `▲ ${d.delta.toFixed(0)}%`,
                tone: "danger" as const,
              }))}
              empty="Belum ada kenaikan harga."
            />
            <InsightCard
              title="Barang Turun Harga"
              icon={<TrendingDown className="h-4 w-4 text-success" />}
              rows={turun.map((d) => ({
                nama: d.nama,
                badge: `▼ ${Math.abs(d.delta).toFixed(0)}%`,
                tone: "success" as const,
              }))}
              empty="Belum ada penurunan harga."
            />
            <InsightCard
              title="Paling Sering Dibeli"
              icon={<Repeat className="h-4 w-4 text-info" />}
              rows={sering.map(([nama, n]) => ({ nama, badge: `${n}x`, tone: "info" as const }))}
              empty="Belum ada data pembelian."
            />
          </div>
        </div>
      )}
    </>
  );
}

function InsightCard({
  title,
  icon,
  rows,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { nama: string; badge: string; tone: "danger" | "success" | "info" }[];
  empty: string;
}) {
  const toneClass = {
    danger: "text-destructive bg-destructive/10",
    success: "text-success bg-success/10",
    info: "text-info bg-info/10",
  };
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span>{icon}</span>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="truncate">{r.nama}</span>
              <span
                className={`ml-2 shrink-0 rounded-full px-2 py-0.5 font-mono text-xs ${toneClass[r.tone]}`}
              >
                {r.badge}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
