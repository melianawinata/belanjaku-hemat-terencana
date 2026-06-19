import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShoppingBasket } from "lucide-react";

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
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", data.session.user.id);
        const isAdmin = (roles ?? []).some((r) => r.role === "admin");
        navigate({ to: isAdmin ? "/admin/dashboard" : "/app/dashboard" });
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

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-pw">Password</Label>
        <Input id="login-pw" type="password" required value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Masuk
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Link to="/reset-password" className="text-info hover:underline">Lupa password?</Link>
      </div>
    </form>
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
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
  );
}
