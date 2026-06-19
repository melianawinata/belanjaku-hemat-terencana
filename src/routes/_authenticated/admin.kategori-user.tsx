import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin-crud";

export const Route = createFileRoute("/_authenticated/admin/kategori-user")({
  head: () => ({ meta: [{ title: "Master Kategori User — Admin BelanjaKu" }] }),
  component: () => (
    <AdminCrud
      title="Master Kategori User"
      subtitle="Kelola kategori pengguna (persona)"
      table="kategori_user"
      queryKey="admin_kategori_user"
      searchKey="nama"
      fields={[{ key: "nama", label: "Nama Kategori", placeholder: "Contoh: Ibu Rumah Tangga" }]}
      columns={["Nama"]}
      renderRow={(r) => [<span className="font-medium">{String(r.nama)}</span>]}
    />
  ),
});
