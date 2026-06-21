import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin-crud";

export const Route = createFileRoute("/_authenticated/admin/kategori-pengeluaran")({
  head: () => ({ meta: [{ title: "Master Kategori Pengeluaran — Admin BelanjaKu" }] }),
  component: () => (
    <AdminCrud
      title="Master Kategori Pengeluaran"
      subtitle="Kelola kategori pengeluaran non-belanja (makan luar, jajan online, dll)"
      table="kategori_pengeluaran"
      queryKey="admin_kategori_pengeluaran"
      searchKey="nama"
      fields={[{ key: "nama", label: "Nama Kategori", placeholder: "Contoh: Makan Luar" }]}
      columns={["Nama"]}
      renderRow={(r) => [<span className="font-medium">{String(r.nama)}</span>]}
    />
  ),
});
