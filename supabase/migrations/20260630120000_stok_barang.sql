-- ============================================================
-- Fitur Stok Barang — inventaris barang belanjaan (milik KELUARGA)
-- ------------------------------------------------------------
-- Model "ledger ringan", dua lapis:
--   * stok_mutasi : buku besar pergerakan stok (SUMBER KEBENARAN).
--       tipe  = 'masuk' | 'keluar' | 'koreksi'
--       sumber= 'manual' | 'belanja' | 'menu'  (asal pergerakan)
--       ref_id= id baris asal (belanja_item / rencana_makan) untuk idempotensi
--   * stok_barang : SALDO terkini per barang (1 baris per keluarga+barang).
--       kolom `jumlah` DI-MAINTAIN OTOMATIS oleh trigger dari SUM(stok_mutasi);
--       kolom lain (jumlah_minimum, lokasi, tanggal_expired, ...) diisi user.
--
-- Identitas barang mengikuti pola belanja/menu: pakai master `item` bila ada,
-- atau nama bebas (item_id NULL) bila tidak. Dedup lewat kolom `item_key`
-- (GENERATED): item_id::text, atau 'free:'+nama-ternormalisasi. Jadi user tak
-- perlu hak admin untuk membuat master item.
--
-- Integrasi loop (belanja->masuk, menu->keluar, stok rendah->saran belanja)
-- ditambahkan di migrasi berikutnya; idempotensi disiapkan via uq index ref.
--
-- Gating fitur (paket berbayar) ditegakkan di UI/level aplikasi (seperti menu).
-- ============================================================

-- ============ STOK MUTASI (buku besar, sumber kebenaran) ============
CREATE TABLE public.stok_mutasi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keluarga_id UUID NOT NULL REFERENCES public.keluarga(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.item(id) ON DELETE SET NULL,
  nama TEXT NOT NULL,
  kategori_barang_id UUID REFERENCES public.kategori_barang(id) ON DELETE SET NULL,
  tipe TEXT NOT NULL CHECK (tipe IN ('masuk', 'keluar', 'koreksi')),
  -- magnitude pergerakan. masuk/keluar > 0; koreksi boleh +/- (selisih penyesuaian).
  jumlah NUMERIC NOT NULL CHECK (jumlah <> 0),
  satuan TEXT NOT NULL DEFAULT 'pcs',
  sumber TEXT NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual', 'belanja', 'menu')),
  ref_id UUID,
  catatan TEXT,
  -- kunci identitas barang (dedup): master item, atau nama bebas ternormalisasi.
  item_key TEXT GENERATED ALWAYS AS (
    COALESCE(item_id::text, 'free:' || lower(btrim(nama)))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stok_mutasi TO authenticated;
GRANT ALL ON public.stok_mutasi TO service_role;
ALTER TABLE public.stok_mutasi ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stok_mutasi_keluarga_key ON public.stok_mutasi (keluarga_id, item_key);
-- Idempotensi integrasi: satu pergerakan per (sumber, baris-asal, barang).
CREATE UNIQUE INDEX uq_stok_mutasi_ref
  ON public.stok_mutasi (sumber, ref_id, item_key) WHERE ref_id IS NOT NULL;

-- ============ STOK BARANG (saldo terkini, 1 baris / keluarga+barang) ============
CREATE TABLE public.stok_barang (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keluarga_id UUID NOT NULL REFERENCES public.keluarga(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.item(id) ON DELETE SET NULL,
  nama TEXT NOT NULL,
  kategori_barang_id UUID REFERENCES public.kategori_barang(id) ON DELETE SET NULL,
  -- saldo; DIHITUNG OTOMATIS oleh trigger sync_stok_saldo (jangan diubah dari client).
  jumlah NUMERIC NOT NULL DEFAULT 0,
  satuan TEXT NOT NULL DEFAULT 'pcs',
  jumlah_minimum NUMERIC,
  lokasi TEXT,
  tanggal_expired DATE,
  catatan TEXT,
  item_key TEXT GENERATED ALWAYS AS (
    COALESCE(item_id::text, 'free:' || lower(btrim(nama)))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (keluarga_id, item_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stok_barang TO authenticated;
GRANT ALL ON public.stok_barang TO service_role;
ALTER TABLE public.stok_barang ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stok_barang_keluarga ON public.stok_barang (keluarga_id);

CREATE TRIGGER trg_stok_barang_updated BEFORE UPDATE ON public.stok_barang
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SYNC SALDO: stok_barang.jumlah = SUM(stok_mutasi) ============
-- Dipicu tiap perubahan stok_mutasi. Recompute penuh (anti-drift) lalu upsert
-- baris saldo per (keluarga, item_key). ON CONFLICT hanya menimpa `jumlah` ->
-- metadata user (minimum/lokasi/expired) terjaga.
-- SECURITY DEFINER: boleh membuat baris stok_barang walau client tak punya
-- policy INSERT (saldo selalu lewat jalur ini, bukan insert manual client).
CREATE OR REPLACE FUNCTION public.sync_stok_saldo()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _kel UUID := COALESCE(NEW.keluarga_id, OLD.keluarga_id);
  _key TEXT := COALESCE(NEW.item_key, OLD.item_key);
  _total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(CASE tipe WHEN 'keluar' THEN -jumlah ELSE jumlah END), 0)
    INTO _total
    FROM public.stok_mutasi
    WHERE keluarga_id = _kel AND item_key = _key;

  INSERT INTO public.stok_barang
    (keluarga_id, user_id, item_id, nama, kategori_barang_id, satuan, jumlah)
  VALUES (
    _kel,
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.item_id, OLD.item_id),
    COALESCE(NEW.nama, OLD.nama),
    COALESCE(NEW.kategori_barang_id, OLD.kategori_barang_id),
    COALESCE(NEW.satuan, OLD.satuan),
    _total
  )
  ON CONFLICT (keluarga_id, item_key)
    DO UPDATE SET jumlah = EXCLUDED.jumlah, updated_at = now();

  RETURN NULL;
END $$;

CREATE TRIGGER trg_stok_mutasi_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.stok_mutasi
  FOR EACH ROW EXECUTE FUNCTION public.sync_stok_saldo();

-- ============ RLS: per-keluarga, anggota kelola bersama ============
-- stok_mutasi
CREATE POLICY "Lihat mutasi stok keluarga" ON public.stok_mutasi FOR SELECT TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota tambah mutasi stok" ON public.stok_mutasi FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Hapus mutasi sendiri atau kepala" ON public.stok_mutasi FOR DELETE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) AND (user_id = auth.uid() OR public.is_kepala(auth.uid())));
-- Mutasi tak boleh diedit (koreksi = tambah mutasi baru) -> tidak ada policy UPDATE.

-- stok_barang (saldo dibuat oleh trigger; client hanya baca/ubah metadata/hapus)
CREATE POLICY "Lihat stok keluarga" ON public.stok_barang FOR SELECT TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota ubah metadata stok" ON public.stok_barang FOR UPDATE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()))
  WITH CHECK (keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Hapus stok sendiri atau kepala" ON public.stok_barang FOR DELETE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) AND (user_id = auth.uid() OR public.is_kepala(auth.uid())));
