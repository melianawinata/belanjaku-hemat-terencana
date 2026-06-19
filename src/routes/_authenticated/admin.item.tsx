import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminCrud } from "@/components/admin-crud";
import { Skeleton } from "@/components/belanja-ui";

export const Route = createFileRoute("/_authenticated/admin/item")({
  head: () => ({ meta: [{ title: "Master Item — Admin BelanjaKu" }] }),
  component: ItemPage,
});

function ItemPage() {
  const { data: kategori, isLoading } = useQuery({
    queryKey: ["admin_kat_barang_opts"],
    queryFn: async () => (await supabase.from("kategori_barang").select("id, nama").order("nama")).data ?? [],
  });

  if (isLoading) return <div className="space-y-2">{[0,1,2].map(i=><Skeleton key={i} className="h-12" />)}</div>;
  const katMap = new Map((kategori ?? []).map((k) => [k.id, k.nama]));

  return (
    <AdminCrud
      title="Master Item Belanja"
      subtitle="Kelola daftar item belanja"
      table="item"
      queryKey="admin_item"
      select="*"
      searchKey="nama"
      fields={[
        { key: "nama", label: "Nama Item", placeholder: "Contoh: Beras" },
        { key: "kategori_barang_id", label: "Kategori Barang", type: "select", options: (kategori ?? []).map((k) => ({ value: k.id, label: k.nama })) },
        { key: "satuan_default", label: "Satuan Default", placeholder: "Contoh: kg" },
      ]}
      columns={["Nama", "Kategori", "Satuan"]}
      renderRow={(r) => [
        <span className="font-medium">{String(r.nama)}</span>,
        <span className="text-muted-foreground">{katMap.get(String(r.kategori_barang_id)) ?? "-"}</span>,
        <span className="font-mono text-xs">{String(r.satuan_default)}</span>,
      ]}
    />
  );
}
