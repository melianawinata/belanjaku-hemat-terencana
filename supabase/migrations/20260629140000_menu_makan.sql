-- ============================================================
-- Fitur Menu Makan harian (pagi/siang/sore) + hubungkan ke belanja
-- ------------------------------------------------------------
-- Dua lapis, milik KELUARGA (berbagi seperti belanja):
--   * menu_masakan  : resep/menu yang bisa dipakai ulang.
--   * menu_komponen : komponen tiap menu. Tipe menentukan tujuan saat
--                     "dibelanjakan":
--                       - 'belanja'     -> belanja_item (bahan untuk dimasak)
--                       - 'pengeluaran' -> pengeluaran_lain (beli jadi/makan luar)
--   * rencana_makan : tempel menu ke (tanggal, slot), dengan porsi.
--
-- Gating fitur (paket berbayar) ditegakkan di UI/level aplikasi.
-- ============================================================

-- ============ MENU MASAKAN ============
CREATE TABLE public.menu_masakan (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keluarga_id UUID NOT NULL REFERENCES public.keluarga(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_masakan TO authenticated;
GRANT ALL ON public.menu_masakan TO service_role;
ALTER TABLE public.menu_masakan ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_menu_masakan_keluarga ON public.menu_masakan (keluarga_id);

-- ============ MENU KOMPONEN ============
CREATE TABLE public.menu_komponen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id UUID NOT NULL REFERENCES public.menu_masakan(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL DEFAULT 'belanja' CHECK (tipe IN ('belanja', 'pengeluaran')),
  -- tipe 'belanja'
  item_id UUID REFERENCES public.item(id) ON DELETE SET NULL,
  kategori_barang_id UUID REFERENCES public.kategori_barang(id) ON DELETE SET NULL,
  nama TEXT NOT NULL,
  jumlah NUMERIC NOT NULL DEFAULT 1,
  satuan TEXT NOT NULL DEFAULT 'pcs',
  -- tipe 'pengeluaran'
  perkiraan_biaya NUMERIC NOT NULL DEFAULT 0,
  kategori_pengeluaran_id UUID REFERENCES public.kategori_pengeluaran(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_komponen TO authenticated;
GRANT ALL ON public.menu_komponen TO service_role;
ALTER TABLE public.menu_komponen ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_menu_komponen_menu ON public.menu_komponen (menu_id);

-- ============ RENCANA MAKAN ============
CREATE TABLE public.rencana_makan (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keluarga_id UUID NOT NULL REFERENCES public.keluarga(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('pagi', 'siang', 'sore')),
  menu_id UUID NOT NULL REFERENCES public.menu_masakan(id) ON DELETE CASCADE,
  porsi NUMERIC NOT NULL DEFAULT 1,
  -- ditandai saat sudah diubah jadi belanja/pengeluaran (idempoten saat re-generate).
  dibelanjakan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rencana_makan TO authenticated;
GRANT ALL ON public.rencana_makan TO service_role;
ALTER TABLE public.rencana_makan ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rencana_makan_keluarga_tanggal ON public.rencana_makan (keluarga_id, tanggal);

-- ============ RLS (per-keluarga, anggota kelola bersama) ============
-- menu_masakan
CREATE POLICY "Lihat menu keluarga" ON public.menu_masakan FOR SELECT TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota tambah menu" ON public.menu_masakan FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Anggota ubah menu" ON public.menu_masakan FOR UPDATE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()))
  WITH CHECK (keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Hapus menu sendiri atau kepala" ON public.menu_masakan FOR DELETE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) AND (user_id = auth.uid() OR public.is_kepala(auth.uid())));

-- menu_komponen (akses lewat keluarga pemilik menu)
CREATE POLICY "Lihat komponen menu keluarga" ON public.menu_komponen FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.menu_masakan m
            WHERE m.id = menu_komponen.menu_id AND m.keluarga_id = public.keluarga_saya(auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Kelola komponen menu keluarga" ON public.menu_komponen FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.menu_masakan m
            WHERE m.id = menu_komponen.menu_id AND m.keluarga_id = public.keluarga_saya(auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.menu_masakan m
            WHERE m.id = menu_komponen.menu_id AND m.keluarga_id = public.keluarga_saya(auth.uid()))
  );

-- rencana_makan
CREATE POLICY "Lihat rencana keluarga" ON public.rencana_makan FOR SELECT TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota tambah rencana" ON public.rencana_makan FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Anggota ubah rencana" ON public.rencana_makan FOR UPDATE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()))
  WITH CHECK (keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Hapus rencana sendiri atau kepala" ON public.rencana_makan FOR DELETE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) AND (user_id = auth.uid() OR public.is_kepala(auth.uid())));
