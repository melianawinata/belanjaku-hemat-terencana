import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin-crud";

export const Route = createFileRoute("/_authenticated/admin/kategori-barang")({
  head: () => ({ meta: [{ title: "Master Kategori Barang — Admin BelanjaKu" }] }),
  component: () => (
    <AdminCrud
      title="Master Kategori Barang"
      subtitle="Kelola kategori barang belanja"
      table="kategori_barang"
      queryKey="admin_kategori_barang"
      searchKey="nama"
      fields={[{ key: "nama", label: "Nama Kategori", placeholder: "Contoh: Sembako" }]}
      columns={["Nama"]}
      renderRow={(r) => [<span className="font-medium">{String(r.nama)}</span>]}
    />
  ),
});
