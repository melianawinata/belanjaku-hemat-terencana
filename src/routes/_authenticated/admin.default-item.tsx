import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin-shell";
import { Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/default-item")({
  head: () => ({ meta: [{ title: "Default Item per Kategori — Admin BelanjaKu" }] }),
  component: DefaultItemPage,
});

function DefaultItemPage() {
  const [kategoriId, setKategoriId] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["default_item_master"],
    queryFn: async () => {
      const [{ data: ku }, { data: items }] = await Promise.all([
        supabase.from("kategori_user").select("id, nama").order("nama"),
        supabase.from("item").select("id, nama").order("nama"),
      ]);
      return { kategoriUser: ku ?? [], items: items ?? [] };
    },
  });

  const { data: defaults, refetch } = useQuery({
    queryKey: ["default_item_sel", kategoriId],
    enabled: !!kategoriId,
    queryFn: async () => (await supabase.from("default_item_kategori").select("item_id").eq("kategori_user_id", kategoriId)).data ?? [],
  });

  useEffect(() => {
    const init: Record<string, boolean> = {};
    (defaults ?? []).forEach((d) => { init[d.item_id] = true; });
    setChecked(init);
  }, [defaults]);

  const simpan = async () => {
    if (!kategoriId) return;
    setSaving(true);
    await supabase.from("default_item_kategori").delete().eq("kategori_user_id", kategoriId);
    const rows = Object.entries(checked).filter(([, v]) => v).map(([item_id]) => ({ kategori_user_id: kategoriId, item_id }));
    if (rows.length > 0) await supabase.from("default_item_kategori").insert(rows);
    setSaving(false);
    toast.success("Default item disimpan.");
    refetch();
  };

  if (isLoading) return (<><AdminHeader title="Default Item per Kategori" /><Skeleton className="h-40" /></>);

  return (
    <>
      <AdminHeader title="Default Item per Kategori" subtitle="Atur item default yang muncul saat onboarding & template" />
      <div className="max-w-md">
        <Select value={kategoriId} onValueChange={setKategoriId}>
          <SelectTrigger><SelectValue placeholder="Pilih kategori user" /></SelectTrigger>
          <SelectContent>{(data?.kategoriUser ?? []).map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {kategoriId && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-1 rounded-2xl border bg-card p-2 shadow-sm sm:grid-cols-2">
            {(data?.items ?? []).map((it) => (
              <label key={it.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted">
                <Checkbox checked={!!checked[it.id]} onCheckedChange={(v) => setChecked((p) => ({ ...p, [it.id]: !!v }))} />
                <span className="text-sm">{it.nama}</span>
              </label>
            ))}
          </div>
          <Button onClick={simpan} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Default Item</Button>
        </div>
      )}
    </>
  );
}
