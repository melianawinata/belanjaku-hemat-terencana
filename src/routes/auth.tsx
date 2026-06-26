import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { routeAfterAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShoppingBasket, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk / Daftar — BelanjaKu" },
      { name: "description", content: "Masuk atau daftar ke BelanjaKu untuk mulai mengatur belanja bulananmu." },
    ],
  }),
  component: AuthPage,
});

function passwordStrength(pw: string): { label: string; pct: number; color: string } {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Lemah", pct: 25, color: "bg-destructive" };
  if (score === 2) return { label: "Cukup", pct: 50, color: "bg-warning" };
  if (score === 3) return { label: "Baik", pct: 75, color: "bg-info" };
  return { label: "Kuat", pct: 100, color: "bg-success" };
}

function AuthPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        // User yang sudah masuk tidak boleh berhenti di halaman masuk/daftar.
        // Profil belum lengkap -> diarahkan ke Lengkapi Profil.
        const target = await routeAfterAuth(data.session.user.id);
        navigate({ to: target, replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingBasket className="h-5 w-5" />
          </span>
          <span className="font-mono text-lg font-semibold tracking-tight">BelanjaKu</span>
        </Link>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <Tabs defaultValue="masuk">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="masuk">Masuk</TabsTrigger>
              <TabsTrigger value="daftar">Daftar</TabsTrigger>
            </TabsList>
            <TabsContent value="masuk"><LoginForm /></TabsContent>
            <TabsContent value="daftar"><RegisterForm /></TabsContent>
          </Tabs>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Dengan masuk, kamu setuju dengan ketentuan layanan BelanjaKu.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function GoogleButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);

  const masukGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Selalu tampilkan pemilih akun, hindari auto-login akun yang salah.
        queryParams: { prompt: "select_account" },
      },
    });
    // Bila berhasil, browser sudah dialihkan ke Google — kode di bawah hanya jalan saat gagal.
    if (error) {
      setLoading(false);
      toast.error("Gagal memulai login Google: " + error.message);
    }
  };

  return (
    <Button type="button" variant="outline" className="w-full" onClick={masukGoogle} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );
}

function OrDivider() {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">atau</span>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr("Email atau password salah.");
      return;
    }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    toast.success("Berhasil masuk. Selamat datang kembali! 👋");
    navigate({ to: isAdmin ? "/admin/dashboard" : "/app/dashboard" });
  };

  return (
    <div className="mt-6">
      <GoogleButton label="Masuk dengan Google" />
      <OrDivider />
      <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-pw">Password</Label>
        <div className="relative">
          <Input id="login-pw" type={showPassword ? "text" : "password"} required value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-10" />
          <button type="button" onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Masuk
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Link to="/reset-password" className="text-info hover:underline">Lupa password?</Link>
      </div>
      </form>
    </div>
  );
}

function RegisterForm() {
  const navigate = useNavigate();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [kategori, setKategori] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const { data: kategoriList } = useQuery({
    queryKey: ["kategori_user_public"],
    queryFn: async () => {
      const { data } = await supabase.from("kategori_user").select("id, nama").order("nama");
      return data ?? [];
    },
  });

  const strength = passwordStrength(password);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (password.length < 6) { setErr("Password minimal 6 karakter."); return; }
    if (!kategori) { setErr("Pilih kategori pengguna dulu ya."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nama, kategori_user_id: kategori },
      },
    });
    setLoading(false);
    if (error) {
      setErr(error.message.includes("already") ? "Email ini sudah terdaftar." : error.message);
      return;
    }
    toast.success("Akun berhasil dibuat! 🎉");
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="mt-6">
      <GoogleButton label="Daftar dengan Google" />
      <OrDivider />
      <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reg-nama">Nama</Label>
        <Input id="reg-nama" required value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-email">Email</Label>
        <Input id="reg-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reg-pw">Password</Label>
        <Input id="reg-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" />
        {password && (
          <div className="space-y-1 pt-1">
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div className={`h-1.5 rounded-full transition-all ${strength.color}`} style={{ width: `${strength.pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Kekuatan: {strength.label}</p>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Kategori Pengguna</Label>
        <Select value={kategori} onValueChange={setKategori}>
          <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
          <SelectContent>
            {(kategoriList ?? []).map((k) => (
              <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Daftar
      </Button>
      </form>
    </div>
  );
}
