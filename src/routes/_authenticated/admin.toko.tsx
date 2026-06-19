import { createFileRoute } from "@tanstack/react-router";
import { AdminCrud } from "@/components/admin-crud";

export const Route = createFileRoute("/_authenticated/admin/toko")({
  head: () => ({ meta: [{ title: "Master Toko — Admin BelanjaKu" }] }),
  component: () => (
    <AdminCrud
      title="Master Toko"
      subtitle="Kelola daftar toko"
      table="toko"
      queryKey="admin_toko"
      searchKey="nama"
      fields={[
        { key: "nama", label: "Nama Toko", placeholder: "Contoh: Indomaret" },
        { key: "tipe", label: "Tipe", type: "select", options: [
          { value: "Minimarket", label: "Minimarket" },
          { value: "Supermarket", label: "Supermarket" },
          { value: "Pasar", label: "Pasar" },
          { value: "Warung", label: "Warung" },
        ] },
      ]}
      columns={["Nama", "Tipe"]}
      renderRow={(r) => [
        <span className="font-medium">{String(r.nama)}</span>,
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs">{String(r.tipe)}</span>,
      ]}
    />
  ),
});
