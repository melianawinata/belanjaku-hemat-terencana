import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { getMySubscription, getPaymentHistory } from "@/lib/api/subscription.functions";
import { PageHeader } from "@/components/app-shell";
import { Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, LogOut, Crown } from "lucide-react";

const PLAN_LABEL: Record<string, string> = { plus: "Plus", keluarga: "Keluarga" };

// Label + warna untuk status transaksi pembayaran.
function statusBadge(status: string): { text: string; cls: string } {
  switch (status) {
    case "paid":
      return { text: "Lunas", cls: "bg-emerald-100 text-emerald-700" };
    case "pending":
      return { text: "Menunggu", cls: "bg-amber-100 text-amber-700" };
    case "expired":
      return { text: "Kedaluwarsa", cls: "bg-muted text-muted-foreground" };
    case "cancelled":
      return { text: "Dibatalkan", cls: "bg-muted text-muted-foreground" };
    default:
      return { text: "Gagal", cls: "bg-red-100 text-red-700" };
  }
}

export const Route = createFileRoute("/_authenticated/app/profil")({
  head: () => ({ meta: [{ title: "Profil Saya — BelanjaKu" }] }),
  component: ProfilPage,
});

function ProfilPage() {
  const { userId, profile, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("");
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const { data: kategoriList } = useQuery({
    queryKey: ["kategori_user_public"],
    queryFn: async () =>
      (await supabase.from("kategori_user").select("id, nama").order("nama")).data ?? [],
  });

  const { data: sub } = useQuery({
    queryKey: ["my_subscription"],
    queryFn: () => getMySubscription(),
  });
  const { data: riwayat, isLoading: riwayatLoading } = useQuery({
    queryKey: ["payment_history"],
    queryFn: () => getPaymentHistory(),
  });

  useEffect(() => {
    if (profile) {
      setNama(profile.nama);
      setKategori(profile.kategori_user_id ?? "");
    }
  }, [profile]);

  const simpan = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ nama, kategori_user_id: kategori || null })
      .eq("id", userId);
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profil diperbarui.");
  };

  const gantiPw = async () => {
    if (pw.length < 6) {
      toast.error("Password minimal 6 karakter.");
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPw("");
    toast.success("Password berhasil diubah.");
  };

  const keluar = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading)
    return (
      <>
        <PageHeader title="Profil Saya" />
        <Skeleton className="h-40" />
      </>
    );

  return (
    <>
      <PageHeader title="Profil Saya" subtitle="Kelola data akunmu" />
      <div className="max-w-xl space-y-5">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 font-mono text-xl font-semibold text-primary">
              {(profile?.nama || "?").charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="font-semibold">{profile?.nama}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama</Label>
              <Input value={nama} onChange={(e) => setNama(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={profile?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Kategori Pengguna</Label>
              <Select value={kategori} onValueChange={setKategori}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {(kategoriList ?? []).map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={simpan} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Profil
            </Button>
          </div>
        </div>

        {/* Langganan & riwayat pembayaran */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${sub?.plan ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                <Crown className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">
                  Paket {sub?.plan ? (PLAN_LABEL[sub.plan] ?? sub.plan) : "Gratis"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sub?.active_until
                    ? `Aktif sampai ${formatTanggal(sub.active_until)}`
                    : "Fitur dasar, gratis selamanya"}
                </p>
              </div>
            </div>
            {sub?.plan ? (
              <Link
                to="/app/langganan/checkout"
                search={{
                  plan: sub.plan as "plus" | "keluarga",
                  siklus: (sub.cycle as "bulanan" | "tahunan") ?? "bulanan",
                }}
              >
                <Button variant="outline" size="sm">
                  Perpanjang
                </Button>
              </Link>
            ) : (
              <Link to="/app/langganan">
                <Button variant="outline" size="sm">
                  Lihat Paket
                </Button>
              </Link>
            )}
          </div>

          <p className="mb-2 text-sm font-semibold">Riwayat Pembayaran</p>
          {riwayatLoading ? (
            <Skeleton className="h-20" />
          ) : !riwayat || riwayat.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
          ) : (
            <ul className="divide-y text-sm">
              {riwayat.map((h) => {
                const badge = statusBadge(h.status);
                return (
                  <li key={h.order_id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {PLAN_LABEL[h.plan_code] ?? h.plan_code} · {h.cycle}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatTanggal(h.paid_at ?? h.created_at)} · {h.order_id}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono">{formatRupiah(h.gross_amount)}</p>
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${badge.cls}`}
                      >
                        {badge.text}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="mb-3 font-semibold">Ganti Password</p>
          <div className="flex flex-wrap gap-2">
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Password baru (min. 6)"
              className="max-w-xs"
            />
            <Button variant="outline" onClick={gantiPw} disabled={pwSaving}>
              {pwSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Ubah Password
            </Button>
          </div>
        </div>

        <Button variant="outline" className="w-full text-destructive" onClick={keluar}>
          <LogOut className="mr-2 h-4 w-4" /> Keluar
        </Button>
      </div>
    </>
  );
}
