import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// dynamic table names require an untyped client
const sb = supabase as unknown as { from: (t: string) => any };
import { AdminHeader } from "@/components/admin-shell";
import { EmptyState, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Search, Inbox } from "lucide-react";

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface Props {
  title: string;
  subtitle: string;
  table: string;
  queryKey: string;
  fields: FieldDef[];
  select?: string;
  searchKey?: string;
  renderRow: (row: Record<string, unknown>) => ReactNode[];
  columns: string[];
  pageSize?: number;
}

export function AdminCrud({ title, subtitle, table, queryKey, fields, select = "*", searchKey, renderRow, columns, pageSize = 10 }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await sb.from(table).select(select).order("created_at", { ascending: false })).data ?? [],
  });

  const rows = (data ?? []) as Record<string, unknown>[];
  const filtered = searchKey && search
    ? rows.filter((r) => String(r[searchKey] ?? "").toLowerCase().includes(search.toLowerCase()))
    : rows;
  const pages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const remove = async (id: string) => {
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) { toast.error("Gagal hapus — mungkin data ini masih dipakai."); return; }
    toast.success("Data dihapus.");
    refetch();
  };

  return (
    <>
      <AdminHeader title={title} subtitle={subtitle} action={
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Tambah</Button>
      } />

      {searchKey && (
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Cari..." className="pl-9" />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[0,1,2].map(i=><Skeleton key={i} className="h-12" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Inbox className="h-7 w-7" />} title="Belum ada data" desc="Tambahkan data baru lewat tombol Tambah."
          action={<Button onClick={() => { setEditing(null); setDialogOpen(true); }}>Tambah Data</Button>} />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {columns.map((c) => <th key={c} className="px-4 py-2.5 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{c}</th>)}
                    <th className="px-4 py-2.5 text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paged.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-muted/30">
                      {renderRow(r).map((cell, i) => <td key={i} className="px-4 py-3">{cell}</td>)}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus data ini?</AlertDialogTitle>
                                <AlertDialogDescription>Tindakan ini tidak bisa dibatalkan. Data yang masih dipakai pengguna tidak akan terhapus.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(String(r.id))}>Hapus</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Halaman {page + 1} dari {pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
                <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
              </div>
            </div>
          )}
        </>
      )}

      <CrudDialog open={dialogOpen} onOpenChange={setDialogOpen} table={table} fields={fields} editing={editing} onSaved={refetch} />
    </>
  );
}

function CrudDialog({ open, onOpenChange, table, fields, editing, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; table: string; fields: FieldDef[];
  editing: Record<string, unknown> | null; onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // init values when dialog opens
  const [lastEditing, setLastEditing] = useState<unknown>(undefined);
  if (open && lastEditing !== editing) {
    const init: Record<string, string> = {};
    fields.forEach((f) => { init[f.key] = editing ? String(editing[f.key] ?? "") : (f.type === "select" ? (f.options?.[0]?.value ?? "") : ""); });
    setValues(init);
    setLastEditing(editing);
  }
  if (!open && lastEditing !== undefined) setLastEditing(undefined);

  const save = async () => {
    for (const f of fields) {
      if (f.type !== "select" && !values[f.key]?.trim()) { toast.error(`${f.label} wajib diisi.`); return; }
    }
    setSaving(true);
    const payload: Record<string, unknown> = {};
    fields.forEach((f) => { payload[f.key] = values[f.key] || null; });
    let error;
    if (editing) ({ error } = await sb.from(table).update(payload).eq("id", String(editing.id)));
    else ({ error } = await sb.from(table).insert(payload));
    setSaving(false);
    if (error) { toast.error(error.message.includes("duplicate") ? "Data sudah ada." : error.message); return; }
    toast.success(editing ? "Data diperbarui." : "Data ditambahkan.");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit Data" : "Tambah Data"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              {f.type === "select" ? (
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={values[f.key] ?? ""} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}>
                  <option value="">Pilih {f.label}</option>
                  {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <Input value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter><Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
