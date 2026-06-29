import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { useKeluarga } from "@/lib/useKeluarga";
import {
  gabungViaKode,
  generateKode,
  gantiNamaKeluarga,
  keluarDariKeluarga,
  keluarkanAnggota,
} from "@/lib/api/keluarga.functions";
import { PageHeader } from "@/components/app-shell";
import { Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Users,
  Crown,
  Copy,
  RefreshCw,
  LogOut,
  UserMinus,
  Check,
  Pencil,
  Loader2,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/keluarga")({
  head: () => ({ meta: [{ title: "Keluarga — BelanjaKu" }] }),
  component: KeluargaPage,
});

function KeluargaPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { detail, anggota, isKepala, memberCount, canInvite, loading, refetch } = useKeluarga();

  const [kodeInput, setKodeInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editNama, setEditNama] = useState(false);
  const [namaInput, setNamaInput] = useState("");

  // Setelah perubahan keluarga, data belanja/pengeluaran ikut berubah scope.
  const invalidateAll = () => {
    refetch();
    queryClient.invalidateQueries();
  };

  const run = async (key: string, fn: () => Promise<unknown>, sukses?: string) => {
    setBusy(key);
    try {
      await fn();
      if (sukses) toast.success(sukses);
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setBusy(null);
    }
  };

  const salinKode = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.keluarga.kode_undangan);
      toast.success("Kode disalin.");
    } catch {
      toast.info(`Kode: ${detail.keluarga.kode_undangan}`);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Keluarga" subtitle="Berbagi belanja dengan anggota keluarga." />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <PageHeader title="Keluarga" subtitle="Berbagi belanja dengan anggota keluarga." />
        <p className="text-sm text-muted-foreground">
          Gagal memuat data keluarga. Coba muat ulang.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Keluarga"
        subtitle="Satu daftar belanja & budget yang bisa diisi bersama anggota keluarga."
      />

      <div className="mx-auto max-w-2xl space-y-5">
        {/* Nama keluarga */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {editNama ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={namaInput}
                  onChange={(e) => setNamaInput(e.target.value)}
                  className="h-9"
                  placeholder="Nama keluarga"
                />
                <Button
                  size="sm"
                  disabled={busy === "nama"}
                  onClick={() =>
                    run(
                      "nama",
                      () => gantiNamaKeluarga({ data: { nama: namaInput.trim() } }),
                      "Nama diperbarui.",
                    ).then(() => setEditNama(false))
                  }
                >
                  {busy === "nama" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditNama(false)}>
                  Batal
                </Button>
              </div>
            ) : (
              <>
                <h2 className="flex-1 text-lg font-semibold">{detail.keluarga.nama}</h2>
                {isKepala && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setNamaInput(detail.keluarga.nama);
                      setEditNama(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {memberCount} anggota{memberCount === 1 ? " (hanya Anda)" : ""}
          </p>
        </div>

        {/* Daftar anggota */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b bg-muted/40 px-4 py-2.5">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Anggota
            </span>
          </div>
          <ul className="divide-y">
            {anggota.map((a) => (
              <li key={a.user_id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
                  {(a.nama || "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.nama}
                    {a.user_id === userId && (
                      <span className="ml-1 text-xs text-muted-foreground">(Anda)</span>
                    )}
                  </p>
                  {a.email && <p className="truncate text-xs text-muted-foreground">{a.email}</p>}
                </div>
                {a.peran === "kepala" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                    <Crown className="h-3 w-3" /> Kepala
                  </span>
                ) : (
                  <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    Anggota
                  </span>
                )}
                {isKepala && a.user_id !== userId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive">
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Keluarkan {a.nama}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {a.nama} akan kembali ke keluarganya sendiri dan tidak lagi melihat
                          belanja keluarga ini.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            run(
                              `kick-${a.user_id}`,
                              () => keluarkanAnggota({ data: { user_id: a.user_id } }),
                              `${a.nama} dikeluarkan.`,
                            )
                          }
                        >
                          Keluarkan
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Undang anggota (kepala) */}
        {isKepala && (
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold">Undang anggota</h3>
            {canInvite ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bagikan kode ini ke anggota keluarga (mis. lewat WhatsApp). Maks 5 anggota.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 rounded-lg border bg-muted/40 px-3 py-2 text-center font-mono text-lg font-bold tracking-[0.3em]">
                    {detail.keluarga.kode_undangan}
                  </code>
                  <Button variant="outline" size="icon" onClick={salinKode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={busy === "kode"}
                    title="Ganti kode"
                    onClick={() => run("kode", () => generateKode(), "Kode baru dibuat.")}
                  >
                    {busy === "kode" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" /> Fitur paket Keluarga
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Untuk mengundang anggota dan berbagi belanja, berlanggananlah paket Keluarga.
                  Anggota yang Anda undang ikut gratis.
                </p>
                <Link to="/app/langganan" className="mt-3 inline-block">
                  <Button size="sm">Lihat paket Keluarga</Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Gabung ke keluarga lain */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Gabung ke keluarga lain</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Punya kode dari kepala keluarga? Masukkan di sini. Anda akan pindah ke keluarga
            tersebut.
          </p>
          <div className="mt-3 space-y-1.5">
            <Label className="sr-only">Kode keluarga</Label>
            <div className="flex items-center gap-2">
              <Input
                value={kodeInput}
                onChange={(e) => setKodeInput(e.target.value.toUpperCase())}
                placeholder="Kode keluarga"
                className="font-mono uppercase tracking-widest"
                maxLength={20}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!kodeInput.trim() || busy === "gabung"}>
                    {busy === "gabung" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Gabung
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Gabung ke keluarga ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Anda akan keluar dari keluarga saat ini dan mulai berbagi belanja dengan
                      keluarga baru. Data belanja lama Anda tetap tersimpan dan bisa diakses lagi
                      jika kembali.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        run(
                          "gabung",
                          () => gabungViaKode({ data: { kode: kodeInput.trim() } }),
                          "Berhasil bergabung ke keluarga.",
                        ).then(() => setKodeInput(""))
                      }
                    >
                      Ya, Gabung
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Keluar dari keluarga */}
        {memberCount > 1 && (
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Keluar dari keluarga
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Keluar dari keluarga?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isKepala
                      ? "Anda kepala keluarga. Keluarkan dulu anggota lain sebelum keluar."
                      : "Anda akan kembali ke keluarga sendiri dan tidak lagi melihat belanja keluarga ini."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      run("keluar", () => keluarDariKeluarga(), "Anda keluar dari keluarga.")
                    }
                  >
                    Ya, Keluar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </>
  );
}
