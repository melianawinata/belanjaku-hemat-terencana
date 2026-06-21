import { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Tags, Package, Store, ListChecks, Boxes, ShoppingBasket, LogOut, ArrowLeft, ShieldAlert, Loader2, Receipt,
} from "lucide-react";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/kategori-user", label: "Kategori User", icon: Tags },
  { to: "/admin/kategori-barang", label: "Kategori Barang", icon: Boxes },
  { to: "/admin/kategori-pengeluaran", label: "Kategori Pengeluaran", icon: Receipt },
  { to: "/admin/item", label: "Master Item", icon: Package },
  { to: "/admin/toko", label: "Master Toko", icon: Store },
  { to: "/admin/default-item", label: "Default Item", icon: ListChecks },
  { to: "/admin/users", label: "Daftar User", icon: Users },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, loading, profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-app-bg"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-bg px-4 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h1 className="text-xl font-bold">Akses ditolak</h1>
        <p className="max-w-sm text-sm text-muted-foreground">Halaman ini khusus admin. Akun kamu tidak punya akses ke area admin.</p>
        <Link to="/app/dashboard"><Button>Ke Dashboard</Button></Link>
      </div>
    );
  }

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-app-bg">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info text-white"><ShoppingBasket className="h-5 w-5" /></span>
          <div><span className="font-mono text-sm font-semibold">BelanjaKu</span><p className="font-mono text-[10px] uppercase tracking-wider text-info">Admin</p></div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive(n.to) ? "bg-info/10 text-info" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <n.icon className="h-[18px] w-[18px]" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t p-3">
          <Link to="/app/dashboard" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Mode Pengguna</Link>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Keluar</Button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <Link to="/app/dashboard" aria-label="Kembali ke Mode Pengguna"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <p className="font-mono text-[11px] uppercase tracking-wider text-info">Panel Admin</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-info/15 font-mono text-sm font-semibold text-info">{(profile?.nama || "A").charAt(0).toUpperCase()}</span>
        </header>
        <main className="px-4 pb-10 pt-5 sm:px-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t bg-background lg:hidden">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className={`flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2 text-[9px] ${isActive(n.to) ? "text-info" : "text-muted-foreground"}`}>
            <n.icon className="h-5 w-5" /> {n.label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function AdminHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
