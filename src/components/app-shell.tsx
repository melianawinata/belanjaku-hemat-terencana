import { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { usePeriode } from "@/lib/periode";
import { bulanIni, bulanBerikutnya, labelBulanTahun } from "@/lib/format";
import {
  LayoutDashboard, ShoppingCart, History, Wallet, Heart, User, Receipt,
  ShoppingBasket, LogOut, Shield, CalendarClock, Users, UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// `short` dipakai untuk bottom-nav mobile yang sempit; sidebar desktop pakai `label`.
const NAV = [
  { to: "/app/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { to: "/app/belanja", label: "Belanja Bulanan", short: "Belanja", icon: ShoppingCart },
  { to: "/app/menu", label: "Menu Makan", short: "Menu", icon: UtensilsCrossed },
  { to: "/app/pengeluaran", label: "Pengeluaran Lain", short: "Lainnya", icon: Receipt },
  { to: "/app/history", label: "History", short: "History", icon: History },
  { to: "/app/budget", label: "Budget", short: "Budget", icon: Wallet },
  { to: "/app/favorit", label: "Favorit", short: "Favorit", icon: Heart },
  { to: "/app/keluarga", label: "Keluarga", short: "Keluarga", icon: Users },
  { to: "/app/profil", label: "Profil", short: "Profil", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const isActive = (to: string) => pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingBasket className="h-5 w-5" />
          </span>
          <span className="font-mono text-base font-semibold tracking-tight">BelanjaKu</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(n.to) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
              <n.icon className="h-[18px] w-[18px]" /> {n.label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin/dashboard"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-info hover:bg-info/10">
              <Shield className="h-[18px] w-[18px]" /> Area Admin
            </Link>
          )}
        </nav>
        <div className="border-t p-3">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Keluar
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
          <div>
            <PeriodeSelector />
            <p className="text-sm font-semibold">Halo, {profile?.nama?.split(" ")[0] || "Sahabat"} 👋</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin/dashboard" aria-label="Ke Area Admin"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-info hover:bg-info/10 lg:hidden">
                <Shield className="h-5 w-5" />
              </Link>
            )}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
              {(profile?.nama || "?").charAt(0).toUpperCase()}
            </span>
          </div>
        </header>
        <PeriodeBanner />
        <main className="px-4 pb-24 pt-5 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* Mobile bottom nav — scrollable agar muat banyak menu */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t bg-background lg:hidden">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to}
            className={`flex min-w-[3.5rem] flex-1 shrink-0 flex-col items-center gap-0.5 py-2 text-[9px] ${
              isActive(n.to) ? "text-primary" : "text-muted-foreground"
            }`}>
            <n.icon className="h-5 w-5" /> {n.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}

// Pemilih periode aktif: bulan ini ↔ bulan depan. Toggle 2 tombol agar langsung
// terlihat — memungkinkan user menyiapkan belanja untuk bulan berikutnya
// (mis. setelah gajian akhir bulan).
function PeriodeSelector() {
  const { isBulanDepan, setPeriode } = usePeriode();
  const ini = bulanIni();
  const depan = bulanBerikutnya(ini.bulan, ini.tahun);
  const opsi = [
    { label: "Bulan ini", periode: ini, aktif: !isBulanDepan },
    { label: "Bulan depan", periode: depan, aktif: isBulanDepan },
  ];

  return (
    <div className="mb-1 inline-flex rounded-lg border bg-muted/50 p-0.5" role="group" aria-label="Periode belanja">
      {opsi.map((o) => (
        <button
          key={o.label}
          onClick={() => setPeriode(o.periode)}
          aria-pressed={o.aktif}
          className={`flex flex-col items-start rounded-md px-2.5 py-0.5 text-left transition-colors ${
            o.aktif ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}>
          <span className="text-[11px] font-semibold leading-tight">{o.label}</span>
          <span className="font-mono text-[9px] uppercase tracking-wider leading-tight opacity-70">
            {labelBulanTahun(o.periode.bulan, o.periode.tahun)}
          </span>
        </button>
      ))}
    </div>
  );
}

// Banner mencolok saat periode aktif bukan bulan berjalan, agar tak ada salah
// input belanja ke periode yang keliru.
function PeriodeBanner() {
  const { bulan, tahun, isBulanDepan, setPeriode } = usePeriode();
  if (!isBulanDepan) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm sm:px-6">
      <span className="flex items-center gap-2 text-foreground">
        <CalendarClock className="h-4 w-4 text-warning" />
        Menyiapkan belanja untuk <strong>{labelBulanTahun(bulan, tahun)}</strong> (bulan depan)
      </span>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPeriode(bulanIni())}>
        Kembali ke bulan ini
      </Button>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
