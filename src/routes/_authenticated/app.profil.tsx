import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { PageHeader } from "@/components/app-shell";
import { Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";

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
    queryFn: async () => (await supabase.from("kategori_user").select("id, nama").order("nama")).data ?? [],
  });

  useEffect(() => {
    if (profile) { setNama(profile.nama); setKategori(profile.kategori_user_id ?? ""); }
  }, [profile]);

  const simpan = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("profiles").update({ nama, kategori_user_id: kategori || null }).eq("id", userId);
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profil diperbarui.");
  };

  const gantiPw = async () => {
    if (pw.length < 6) { toast.error("Password minimal 6 karakter."); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwSaving(false);
    if (error) { toast.error(error.message); return; }
    setPw("");
    toast.success("Password berhasil diubah.");
  };

  const keluar = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading) return (<><PageHeader title="Profil Saya" /><Skeleton className="h-40" /></>);

  return (
    <>
      <PageHeader title="Profil Saya" subtitle="Kelola data akunmu" />
      <div className="max-w-xl space-y-5">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 font-mono text-xl font-semibold text-primary">
              {(profile?.nama || "?").charAt(0).toUpperCase()}
            </span>
            <div><p className="font-semibold">{profile?.nama}</p><p className="text-sm text-muted-foreground">{profile?.email}</p></div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Nama</Label><Input value={nama} onChange={(e) => setNama(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={profile?.email ?? ""} disabled /></div>
            <div className="space-y-1.5">
              <Label>Kategori Pengguna</Label>
              <Select value={kategori} onValueChange={setKategori}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>{(kategoriList ?? []).map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={simpan} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Profil</Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="mb-3 font-semibold">Ganti Password</p>
          <div className="flex flex-wrap gap-2">
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password baru (min. 6)" className="max-w-xs" />
            <Button variant="outline" onClick={gantiPw} disabled={pwSaving}>{pwSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Ubah Password</Button>
          </div>
        </div>

        <Button variant="outline" className="w-full text-destructive" onClick={keluar}><LogOut className="mr-2 h-4 w-4" /> Keluar</Button>
      </div>
    </>
  );
}
