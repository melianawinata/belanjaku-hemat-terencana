-- ============================================================
-- Fitur Konversi Satuan (Opsi C) — stok akurat lintas satuan
-- ------------------------------------------------------------
-- Sebelumnya saldo stok dihitung per item_key TANPA satuan, sehingga
-- belanja "1 kg telur" lalu masak "4 butir" menghasilkan 1 - 4 = -3 (campur).
--
-- Solusi:
--   * Tiap keluarga mendefinisikan konversi item master (item_konversi):
--       1 <satuan> = faktor <item.satuan_default>.
--   * Mutasi stok menyimpan satuan asli + faktor; kolom generated
--       jumlah_dasar = jumlah * faktor menormalkan ke SATUAN DASAR.
--   * Saldo = SUM(jumlah_dasar bertanda); stok_barang selalu dalam satuan dasar.
--   * Item bebas (tanpa master) tak dikonversi: satuan ikut jadi bagian item_key
--       (telur-bebas-butir & telur-bebas-kg jadi dua baris terpisah).
-- ============================================================

-- ============ 1. KONVERSI (master per keluarga) ============
CREATE TABLE public.item_konversi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keluarga_id UUID NOT NULL REFERENCES public.keluarga(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.item(id) ON DELETE CASCADE,
  satuan TEXT NOT NULL,
  -- 1 <satuan> = faktor <item.satuan_default>. Mis. telur: 1 butir = 0.0625 kg.
  faktor NUMERIC NOT NULL CHECK (faktor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (keluarga_id, item_id, satuan)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_konversi TO authenticated;
GRANT ALL ON public.item_konversi TO service_role;
ALTER TABLE public.item_konversi ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_item_konversi_keluarga_item ON public.item_konversi (keluarga_id, item_id);

CREATE POLICY "Lihat konversi keluarga" ON public.item_konversi FOR SELECT TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota tambah konversi" ON public.item_konversi FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Anggota ubah konversi" ON public.item_konversi FOR UPDATE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()))
  WITH CHECK (keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Hapus konversi sendiri atau kepala" ON public.item_konversi FOR DELETE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) AND (user_id = auth.uid() OR public.is_kepala(auth.uid())));

-- ============ 2. RESOLVER KONVERSI ============
-- (satuan_dasar, faktor) untuk (item, satuan):
--   * item bebas (item_id NULL) -> satuan itu sendiri, faktor 1.
--   * master + satuan = satuan_default -> faktor 1.
--   * master + ada di item_konversi -> faktornya.
--   * master + tak dikenal -> RAISE (cegah pencampuran satuan; UI mencegah lebih awal).
CREATE OR REPLACE FUNCTION public.resolve_konversi(
  _keluarga UUID, _item_id UUID, _satuan TEXT
) RETURNS TABLE (satuan_dasar TEXT, faktor NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _base TEXT;
  _f NUMERIC;
BEGIN
  IF _item_id IS NULL THEN
    RETURN QUERY SELECT _satuan, 1::numeric;
    RETURN;
  END IF;

  SELECT satuan_default INTO _base FROM public.item WHERE id = _item_id;
  IF _base IS NULL THEN
    RETURN QUERY SELECT _satuan, 1::numeric;  -- master hilang: jangan blokir.
    RETURN;
  END IF;

  IF lower(btrim(_satuan)) = lower(btrim(_base)) THEN
    RETURN QUERY SELECT _base, 1::numeric;
    RETURN;
  END IF;

  SELECT k.faktor INTO _f
    FROM public.item_konversi k
    WHERE k.keluarga_id = _keluarga
      AND k.item_id = _item_id
      AND lower(btrim(k.satuan)) = lower(btrim(_satuan));

  IF _f IS NULL THEN
    RAISE EXCEPTION 'Satuan "%" belum punya konversi untuk item ini. Tambahkan konversi dulu.', _satuan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY SELECT _base, _f;
END $$;

-- ============ 3. KOLOM NORMALISASI di stok_mutasi ============
ALTER TABLE public.stok_mutasi
  ADD COLUMN satuan_dasar TEXT,
  ADD COLUMN faktor NUMERIC NOT NULL DEFAULT 1 CHECK (faktor > 0);

-- Baris lama: anggap satuan = satuan dasar, faktor 1 (best-effort).
UPDATE public.stok_mutasi SET satuan_dasar = satuan WHERE satuan_dasar IS NULL;

ALTER TABLE public.stok_mutasi
  ADD COLUMN jumlah_dasar NUMERIC GENERATED ALWAYS AS (jumlah * faktor) STORED;

-- ============ 4. ISI satuan_dasar & faktor OTOMATIS (BEFORE) ============
-- Satu jalur tunggal untuk semua sumber (manual/belanja/menu): faktor & satuan
-- dasar selalu dihitung dari (item, satuan) saat baris ditulis.
CREATE OR REPLACE FUNCTION public.stok_mutasi_normalisasi()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _base TEXT;
  _f NUMERIC;
BEGIN
  SELECT r.satuan_dasar, r.faktor INTO _base, _f
    FROM public.resolve_konversi(NEW.keluarga_id, NEW.item_id, NEW.satuan) r;
  NEW.satuan_dasar := _base;
  NEW.faktor := _f;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_stok_mutasi_normalisasi
  BEFORE INSERT OR UPDATE OF item_id, satuan, jumlah, keluarga_id ON public.stok_mutasi
  FOR EACH ROW EXECUTE FUNCTION public.stok_mutasi_normalisasi();

-- ============ 5. item_key: item bebas dipisah per satuan ============
-- stok_mutasi
DROP INDEX IF EXISTS public.idx_stok_mutasi_keluarga_key;
DROP INDEX IF EXISTS public.uq_stok_mutasi_ref;
ALTER TABLE public.stok_mutasi DROP COLUMN item_key;
ALTER TABLE public.stok_mutasi ADD COLUMN item_key TEXT
  GENERATED ALWAYS AS (
    CASE WHEN item_id IS NULL
      THEN 'free:' || lower(btrim(nama)) || '|' || lower(btrim(satuan))
      ELSE item_id::text END
  ) STORED;
CREATE INDEX idx_stok_mutasi_keluarga_key ON public.stok_mutasi (keluarga_id, item_key);
CREATE UNIQUE INDEX uq_stok_mutasi_ref
  ON public.stok_mutasi (sumber, ref_id, item_key) WHERE ref_id IS NOT NULL;

-- stok_barang
ALTER TABLE public.stok_barang DROP CONSTRAINT stok_barang_keluarga_id_item_key_key;
ALTER TABLE public.stok_barang DROP COLUMN item_key;
ALTER TABLE public.stok_barang ADD COLUMN item_key TEXT
  GENERATED ALWAYS AS (
    CASE WHEN item_id IS NULL
      THEN 'free:' || lower(btrim(nama)) || '|' || lower(btrim(satuan))
      ELSE item_id::text END
  ) STORED;
ALTER TABLE public.stok_barang
  ADD CONSTRAINT stok_barang_keluarga_id_item_key_key UNIQUE (keluarga_id, item_key);

-- ============ 6. SALDO pakai jumlah_dasar (selalu satuan dasar) ============
CREATE OR REPLACE FUNCTION public.sync_stok_saldo()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _kel UUID := COALESCE(NEW.keluarga_id, OLD.keluarga_id);
  _key TEXT := COALESCE(NEW.item_key, OLD.item_key);
  _total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(CASE tipe WHEN 'keluar' THEN -jumlah_dasar ELSE jumlah_dasar END), 0)
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
    COALESCE(NEW.satuan_dasar, OLD.satuan_dasar),
    _total
  )
  ON CONFLICT (keluarga_id, item_key)
    DO UPDATE SET jumlah = EXCLUDED.jumlah, satuan = EXCLUDED.satuan, updated_at = now();

  RETURN NULL;
END $$;

-- ============ 7. MENU DIMASAK -> STOK (normalisasi ke satuan dasar) ============
-- Tiap komponen dikonversi (x faktor x porsi) lalu diagregasi per item_key;
-- satu mutasi 'keluar' per barang DALAM SATUAN DASAR.
CREATE OR REPLACE FUNCTION public.rencana_makan_ke_stok()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _now BOOLEAN;
  _was BOOLEAN;
  _remove BOOLEAN;
  _add BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.dimasak_at IS NOT NULL THEN
      DELETE FROM public.stok_mutasi WHERE sumber = 'menu' AND ref_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  _now := NEW.dimasak_at IS NOT NULL;
  _was := (TG_OP = 'UPDATE' AND OLD.dimasak_at IS NOT NULL);

  _remove := (_was AND NOT _now)
          OR (_now AND _was AND NEW.porsi IS DISTINCT FROM OLD.porsi);
  _add := (_now AND NOT _was)
       OR (_now AND _was AND NEW.porsi IS DISTINCT FROM OLD.porsi);

  IF _remove THEN
    DELETE FROM public.stok_mutasi WHERE sumber = 'menu' AND ref_id = NEW.id;
  END IF;

  IF _add THEN
    INSERT INTO public.stok_mutasi
      (keluarga_id, user_id, item_id, nama, kategori_barang_id, tipe, jumlah, satuan, sumber, ref_id)
    SELECT
      NEW.keluarga_id,
      NEW.user_id,
      (array_agg(k.item_id))[1],
      (array_agg(k.nama))[1],
      (array_agg(k.kategori_barang_id))[1],
      'keluar',
      SUM(k.jumlah * NEW.porsi * rk.faktor),   -- dalam satuan dasar
      (array_agg(rk.satuan_dasar))[1],          -- satuan dasar
      'menu',
      NEW.id
    FROM public.menu_komponen k
    CROSS JOIN LATERAL public.resolve_konversi(NEW.keluarga_id, k.item_id, k.satuan) rk
    WHERE k.menu_id = NEW.menu_id AND k.tipe = 'belanja'
    GROUP BY
      CASE WHEN k.item_id IS NULL
        THEN 'free:' || lower(btrim(k.nama)) || '|' || lower(btrim(rk.satuan_dasar))
        ELSE k.item_id::text END
    HAVING SUM(k.jumlah * NEW.porsi * rk.faktor) <> 0
    ON CONFLICT (sumber, ref_id, item_key) WHERE ref_id IS NOT NULL DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

-- (Trigger belanja_item_ke_stok tetap: faktor & satuan_dasar diisi trigger BEFORE.)

-- ============ 8. Rekomputasi saldo sekali jalan (anti-drift) ============
-- item_key & rumus saldo berubah; bangun ulang jumlah dari buku besar.
-- UPSERT: pertahankan metadata user (minimum/lokasi/expired) pada baris lama.
INSERT INTO public.stok_barang (keluarga_id, user_id, item_id, nama, kategori_barang_id, satuan, jumlah)
SELECT
  m.keluarga_id,
  (array_agg(m.user_id ORDER BY m.created_at))[1],
  (array_agg(m.item_id ORDER BY m.created_at))[1],
  (array_agg(m.nama ORDER BY m.created_at))[1],
  (array_agg(m.kategori_barang_id ORDER BY m.created_at))[1],
  (array_agg(m.satuan_dasar ORDER BY m.created_at))[1],
  SUM(CASE m.tipe WHEN 'keluar' THEN -m.jumlah_dasar ELSE m.jumlah_dasar END)
FROM public.stok_mutasi m
GROUP BY m.keluarga_id, m.item_key
ON CONFLICT (keluarga_id, item_key)
  DO UPDATE SET jumlah = EXCLUDED.jumlah, satuan = EXCLUDED.satuan, updated_at = now();
