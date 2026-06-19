import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, Skeleton } from "@/components/belanja-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Heart, Plus, Trash2, Loader2, ChevronsUpDown, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/favorit")({
  head: () => ({ meta: [{ title: "Item Favorit — BelanjaKu" }] }),
  component: FavoritPage,
});

function FavoritPage() {
  const { userId } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["favorit", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("item_favorit")
        .select("id, jumlah_default, satuan_default, item:item_id(id, nama)").eq("user_id", userId!).order("created_at");
      return data ?? [];
    },
  });

  const hapus = async (id: string) => {
    await supabase.from("item_favorit").delete().eq("id", id);
    toast.success("Favorit dihapus.");
    refetch();
  };

  if (isLoading) return (<><PageHeader title="Item Favorit Saya" /><div className="space-y-2">{[0,1,2].map(i=><Skeleton key={i} className="h-14" />)}</div></>);
  const rows = data ?? [];

  return (
    <>
      <PageHeader title="Item Favorit Saya" subtitle="Item langganan yang sering kamu beli" action={<AddFavoritDialog userId={userId!} onDone={refetch} />} />
      {rows.length === 0 ? (
        <EmptyState icon={<Heart className="h-7 w-7" />} title="Belum ada item favorit"
          desc="Tambahkan item langgananmu agar lebih cepat saat menyusun daftar belanja."
          action={<AddFavoritDialog userId={userId!} onDone={refetch} />} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <ul className="divide-y">
            {rows.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <Heart className="h-4 w-4 fill-primary/20 text-primary" />
                <span className="flex-1 text-sm font-medium">{(f.item as { nama: string } | null)?.nama ?? "Item"}</span>
                <span className="font-mono text-xs text-muted-foreground">{f.jumlah_default} {f.satuan_default}</span>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => hapus(f.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function AddFavoritDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<{ id: string; nama: string; satuan: string } | null>(null);
  const [jumlah, setJumlah] = useState("1");
  const [satuan, setSatuan] = useState("pcs");
  const [saving, setSaving] = useState(false);

  const { data: master } = useQuery({
    queryKey: ["master_item"],
    queryFn: async () => (await supabase.from("item").select("id, nama, satuan_default").order("nama")).data ?? [],
  });

  const save = async () => {
    if (!selected) { toast.error("Pilih item dulu."); return; }
    setSaving(true);
    const { error } = await supabase.from("item_favorit").insert({ user_id: userId, item_id: selected.id, jumlah_default: Number(jumlah) || 1, satuan_default: satuan });
    setSaving(false);
    if (error) { toast.error(error.message.includes("duplicate") ? "Item sudah ada di favorit." : error.message); return; }
    toast.success("Ditambahkan ke favorit.");
    setSelected(null); setJumlah("1"); setOpen(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Tambah Favorit</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Tambah Item Favorit</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Item</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">{selected ? selected.nama : "Cari item..."}<ChevronsUpDown className="h-4 w-4 opacity-50" /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cari item..." />
                  <CommandList>
                    <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                    <CommandGroup>
                      {(master ?? []).map((m) => (
                        <CommandItem key={m.id} value={m.nama} onSelect={() => { setSelected({ id: m.id, nama: m.nama, satuan: m.satuan_default }); setSatuan(m.satuan_default); setPickerOpen(false); }}>
                          <Check className={`mr-2 h-4 w-4 ${selected?.id === m.id ? "opacity-100" : "opacity-0"}`} />{m.nama}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Jumlah default</Label><Input type="number" value={jumlah} onChange={(e) => setJumlah(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Satuan</Label><Input value={satuan} onChange={(e) => setSatuan(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
