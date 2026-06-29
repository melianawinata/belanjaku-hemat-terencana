-- ============================================================
-- Fitur Keluarga — berbagi belanja & pengeluaran lain antar akun
-- ------------------------------------------------------------
-- Kepemilikan belanja & pengeluaran lain naik dari PER-USER -> PER-KELUARGA.
-- Tiap user tergabung di TEPAT SATU keluarga (default: keluarga sendiri,
-- beranggota 1). belanja_item.user_id / pengeluaran_lain.user_id tetap dipakai
-- sebagai "ditambahkan oleh" (atribusi).
--
-- Peran:
--   * kepala  : kelola anggota, atur budget, batalkan item siapa pun.
--   * anggota : tambah item, batalkan item sendiri, tandai sudah dibeli.
--
-- Gating: menambah anggota ke-2+ butuh kepala punya paket 'keluarga' aktif
-- (dicek di server function get_active_plan). Anggota yang diundang ikut gratis.
-- ============================================================

-- ============ TABEL: KELUARGA ============
CREATE TABLE public.keluarga (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL DEFAULT 'Keluarga Saya',
  kode_undangan TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keluarga TO authenticated;
GRANT ALL ON public.keluarga TO service_role;
ALTER TABLE public.keluarga ENABLE ROW LEVEL SECURITY;

-- ============ TABEL: ANGGOTA KELUARGA ============
CREATE TABLE public.keluarga_anggota (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keluarga_id UUID NOT NULL REFERENCES public.keluarga(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peran TEXT NOT NULL DEFAULT 'anggota' CHECK (peran IN ('kepala', 'anggota')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id) -- satu user = satu keluarga (belanja tak ambigu)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keluarga_anggota TO authenticated;
GRANT ALL ON public.keluarga_anggota TO service_role;
ALTER TABLE public.keluarga_anggota ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_keluarga_anggota_keluarga ON public.keluarga_anggota (keluarga_id);

-- ============ HELPER (SECURITY DEFINER, hindari rekursi RLS) ============
-- keluarga_id milik user; dipakai di policy tabel lain.
CREATE OR REPLACE FUNCTION public.keluarga_saya(_user UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT keluarga_id FROM public.keluarga_anggota WHERE user_id = _user LIMIT 1;
$$;

-- true jika user adalah kepala keluarganya.
CREATE OR REPLACE FUNCTION public.is_kepala(_user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.keluarga_anggota WHERE user_id = _user AND peran = 'kepala'
  );
$$;

-- ============ RLS: keluarga & keluarga_anggota ============
-- Baca: anggota keluarganya. Tulis keanggotaan: lewat server function
-- (service_role) atau trigger signup (SECURITY DEFINER) — tak ada policy
-- INSERT/DELETE untuk authenticated agar tak bisa diakali dari client.
CREATE POLICY "Lihat keluarga sendiri" ON public.keluarga FOR SELECT TO authenticated
  USING (id = public.keluarga_saya(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Kepala ubah keluarga" ON public.keluarga FOR UPDATE TO authenticated
  USING (id = public.keluarga_saya(auth.uid()) AND public.is_kepala(auth.uid()))
  WITH CHECK (id = public.keluarga_saya(auth.uid()));

CREATE POLICY "Lihat anggota sekeluarga" ON public.keluarga_anggota FOR SELECT TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ profiles: izinkan baca profil sekeluarga ("ditambahkan oleh") ============
CREATE POLICY "Lihat profil sekeluarga" ON public.profiles FOR SELECT TO authenticated
  USING (
    public.keluarga_saya(auth.uid()) IS NOT NULL
    AND public.keluarga_saya(id) = public.keluarga_saya(auth.uid())
  );

-- ============ BACKFILL: satu keluarga per user lama (jadi kepala) ============
DO $$
DECLARE
  r RECORD;
  _kid UUID;
  _nama TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT uid FROM (
      SELECT id AS uid FROM public.profiles
      UNION SELECT user_id FROM public.belanja_bulanan
      UNION SELECT user_id FROM public.pengeluaran_lain
      UNION SELECT user_id FROM public.pengeluaran_rutin
    ) s
    WHERE uid IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.keluarga_anggota ka WHERE ka.user_id = s.uid)
  LOOP
    SELECT COALESCE(NULLIF(nama, ''), 'Saya') INTO _nama FROM public.profiles WHERE id = r.uid;
    IF _nama IS NULL THEN _nama := 'Saya'; END IF;
    INSERT INTO public.keluarga (nama, kode_undangan, created_by)
      VALUES ('Keluarga ' || _nama, upper(substr(md5(random()::text || r.uid::text), 1, 8)), r.uid)
      RETURNING id INTO _kid;
    INSERT INTO public.keluarga_anggota (keluarga_id, user_id, peran)
      VALUES (_kid, r.uid, 'kepala');
  END LOOP;
END $$;

-- ============ belanja_bulanan -> milik keluarga ============
ALTER TABLE public.belanja_bulanan ADD COLUMN keluarga_id UUID REFERENCES public.keluarga(id) ON DELETE CASCADE;
UPDATE public.belanja_bulanan SET keluarga_id = public.keluarga_saya(user_id) WHERE keluarga_id IS NULL;
ALTER TABLE public.belanja_bulanan ALTER COLUMN keluarga_id SET NOT NULL;
ALTER TABLE public.belanja_bulanan DROP CONSTRAINT IF EXISTS belanja_bulanan_user_id_bulan_tahun_key;
ALTER TABLE public.belanja_bulanan ADD CONSTRAINT belanja_bulanan_keluarga_bulan_tahun_key UNIQUE (keluarga_id, bulan, tahun);
CREATE INDEX idx_belanja_bulanan_keluarga ON public.belanja_bulanan (keluarga_id, tahun, bulan);

-- Budget hanya boleh diubah kepala (status/lainnya tetap boleh semua anggota).
-- auth.uid() NULL = konteks server/service_role -> diizinkan.
CREATE OR REPLACE FUNCTION public.enforce_budget_kepala()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.budget IS DISTINCT FROM OLD.budget OR NEW.budget_lain IS DISTINCT FROM OLD.budget_lain)
     AND NOT public.is_kepala(auth.uid()) THEN
    RAISE EXCEPTION 'Hanya kepala keluarga yang boleh mengubah budget.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_belanja_budget_kepala BEFORE UPDATE ON public.belanja_bulanan
  FOR EACH ROW EXECUTE FUNCTION public.enforce_budget_kepala();

DROP POLICY IF EXISTS "Lihat belanja sendiri" ON public.belanja_bulanan;
DROP POLICY IF EXISTS "Kelola belanja sendiri" ON public.belanja_bulanan;
CREATE POLICY "Lihat belanja keluarga" ON public.belanja_bulanan FOR SELECT TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota buat belanja keluarga" ON public.belanja_bulanan FOR INSERT TO authenticated
  WITH CHECK (keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Anggota ubah belanja keluarga" ON public.belanja_bulanan FOR UPDATE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()))
  WITH CHECK (keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Kepala hapus belanja keluarga" ON public.belanja_bulanan FOR DELETE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) AND public.is_kepala(auth.uid()));

-- ============ belanja_item -> akses via keluarga pemilik belanja ============
DROP POLICY IF EXISTS "Lihat item belanja sendiri" ON public.belanja_item;
DROP POLICY IF EXISTS "Kelola item belanja sendiri" ON public.belanja_item;
CREATE POLICY "Lihat item keluarga" ON public.belanja_item FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.belanja_bulanan b
            WHERE b.id = belanja_item.belanja_id AND b.keluarga_id = public.keluarga_saya(auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Anggota tambah item keluarga" ON public.belanja_item FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.belanja_bulanan b
                WHERE b.id = belanja_item.belanja_id AND b.keluarga_id = public.keluarga_saya(auth.uid()))
  );
CREATE POLICY "Anggota ubah item keluarga" ON public.belanja_item FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.belanja_bulanan b
            WHERE b.id = belanja_item.belanja_id AND b.keluarga_id = public.keluarga_saya(auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.belanja_bulanan b
            WHERE b.id = belanja_item.belanja_id AND b.keluarga_id = public.keluarga_saya(auth.uid()))
  );
CREATE POLICY "Hapus item sendiri atau kepala" ON public.belanja_item FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.belanja_bulanan b
            WHERE b.id = belanja_item.belanja_id AND b.keluarga_id = public.keluarga_saya(auth.uid()))
    AND (user_id = auth.uid() OR public.is_kepala(auth.uid()))
  );

-- ============ pengeluaran_lain -> milik keluarga ============
ALTER TABLE public.pengeluaran_lain ADD COLUMN keluarga_id UUID REFERENCES public.keluarga(id) ON DELETE CASCADE;
UPDATE public.pengeluaran_lain SET keluarga_id = public.keluarga_saya(user_id) WHERE keluarga_id IS NULL;
ALTER TABLE public.pengeluaran_lain ALTER COLUMN keluarga_id SET NOT NULL;
CREATE INDEX idx_pengeluaran_lain_keluarga ON public.pengeluaran_lain (keluarga_id, tanggal);

DROP POLICY IF EXISTS "Lihat pengeluaran lain sendiri" ON public.pengeluaran_lain;
DROP POLICY IF EXISTS "Kelola pengeluaran lain sendiri" ON public.pengeluaran_lain;
CREATE POLICY "Lihat pengeluaran lain keluarga" ON public.pengeluaran_lain FOR SELECT TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota tambah pengeluaran lain" ON public.pengeluaran_lain FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Anggota ubah pengeluaran lain" ON public.pengeluaran_lain FOR UPDATE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()))
  WITH CHECK (keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Hapus pengeluaran lain sendiri atau kepala" ON public.pengeluaran_lain FOR DELETE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) AND (user_id = auth.uid() OR public.is_kepala(auth.uid())));

-- ============ pengeluaran_rutin -> milik keluarga (anggota kelola) ============
ALTER TABLE public.pengeluaran_rutin ADD COLUMN keluarga_id UUID REFERENCES public.keluarga(id) ON DELETE CASCADE;
UPDATE public.pengeluaran_rutin SET keluarga_id = public.keluarga_saya(user_id) WHERE keluarga_id IS NULL;
ALTER TABLE public.pengeluaran_rutin ALTER COLUMN keluarga_id SET NOT NULL;

DROP POLICY IF EXISTS "Lihat pengeluaran rutin sendiri" ON public.pengeluaran_rutin;
DROP POLICY IF EXISTS "Kelola pengeluaran rutin sendiri" ON public.pengeluaran_rutin;
CREATE POLICY "Lihat pengeluaran rutin keluarga" ON public.pengeluaran_rutin FOR SELECT TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota tambah pengeluaran rutin" ON public.pengeluaran_rutin FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Anggota ubah pengeluaran rutin" ON public.pengeluaran_rutin FOR UPDATE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()))
  WITH CHECK (keluarga_id = public.keluarga_saya(auth.uid()));
CREATE POLICY "Hapus pengeluaran rutin sendiri atau kepala" ON public.pengeluaran_rutin FOR DELETE TO authenticated
  USING (keluarga_id = public.keluarga_saya(auth.uid()) AND (user_id = auth.uid() OR public.is_kepala(auth.uid())));

-- ============ Signup: user baru otomatis punya keluarga sendiri ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _kat UUID;
  _kel UUID;
  _nama TEXT;
BEGIN
  SELECT id INTO _kat FROM public.kategori_user
    WHERE id = (NEW.raw_user_meta_data->>'kategori_user_id')::uuid;

  _nama := COALESCE(NULLIF(NEW.raw_user_meta_data->>'nama', ''), 'Saya');

  INSERT INTO public.profiles (id, nama, email, kategori_user_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nama', ''), NEW.email, _kat);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  -- Keluarga sendiri (beranggota 1, user jadi kepala).
  INSERT INTO public.keluarga (nama, kode_undangan, created_by)
  VALUES ('Keluarga ' || _nama, upper(substr(md5(random()::text || NEW.id::text), 1, 8)), NEW.id)
  RETURNING id INTO _kel;
  INSERT INTO public.keluarga_anggota (keluarga_id, user_id, peran)
  VALUES (_kel, NEW.id, 'kepala');

  RETURN NEW;
END;
$$;
