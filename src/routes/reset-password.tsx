import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShoppingBasket } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Atur Ulang Password — BelanjaKu" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [isRecovery, setIsRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setIsRecovery(true);
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success("Email atur ulang password sudah dikirim.");
  };

  const updatePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password minimal 6 karakter."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password berhasil diubah. Silakan masuk.");
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingBasket className="h-5 w-5" />
          </span>
          <span className="font-mono text-lg font-semibold">BelanjaKu</span>
        </Link>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          {isRecovery ? (
            <form onSubmit={updatePw} className="space-y-4">
              <h1 className="text-xl font-bold">Buat Password Baru</h1>
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">Password Baru</Label>
                <Input id="new-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Password
              </Button>
            </form>
          ) : sent ? (
            <div className="space-y-3 text-center">
              <h1 className="text-xl font-bold">Cek Emailmu 📬</h1>
              <p className="text-sm text-muted-foreground">Kami sudah kirim tautan untuk atur ulang password ke {email}.</p>
              <Link to="/auth"><Button variant="outline" className="w-full">Kembali ke Masuk</Button></Link>
            </div>
          ) : (
            <form onSubmit={sendReset} className="space-y-4">
              <h1 className="text-xl font-bold">Lupa Password?</h1>
              <p className="text-sm text-muted-foreground">Masukkan email kamu, kami kirimkan tautan untuk atur ulang password.</p>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kirim Tautan
              </Button>
              <Link to="/auth" className="block text-center text-sm text-info hover:underline">Kembali ke Masuk</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
