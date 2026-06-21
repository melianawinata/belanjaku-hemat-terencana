-- Fitur Pengeluaran Lain: catat pengeluaran non-belanja (makan luar, jajan online,
-- transportasi, hiburan, dll) yang sering "mengganggu" budget bulanan.
-- Budget pengeluaran lain TERPISAH dari budget belanja (kolom budget_lain).

-- ============ MASTER: KATEGORI PENGELUARAN (dikelola admin) ============
CREATE TABLE public.kategori_pengeluaran (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  urutan INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kategori_pengeluaran TO authenticated;
GRANT SELECT ON public.kategori_pengeluaran TO anon;
GRANT ALL ON public.kategori_pengeluaran TO service_role;
ALTER TABLE public.kategori_pengeluaran ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Baca kategori pengeluaran" ON public.kategori_pengeluaran FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin kelola kategori pengeluaran" ON public.kategori_pengeluaran FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PENGELUARAN LAIN (milik user) ============
CREATE TABLE public.pengeluaran_lain (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  kategori_pengeluaran_id UUID REFERENCES public.kategori_pengeluaran(id) ON DELETE SET NULL,
  deskripsi TEXT NOT NULL DEFAULT '',
  nominal NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pengeluaran_lain TO authenticated;
GRANT ALL ON public.pengeluaran_lain TO service_role;
ALTER TABLE public.pengeluaran_lain ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pengeluaran_lain_user_tanggal ON public.pengeluaran_lain (user_id, tanggal);

CREATE POLICY "Lihat pengeluaran lain sendiri" ON public.pengeluaran_lain FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Kelola pengeluaran lain sendiri" ON public.pengeluaran_lain FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ BUDGET PENGELUARAN LAIN (per bulan, terpisah dari budget belanja) ============
ALTER TABLE public.belanja_bulanan ADD COLUMN budget_lain NUMERIC NOT NULL DEFAULT 0;

-- ============ SEED KATEGORI PENGELUARAN STANDAR ============
INSERT INTO public.kategori_pengeluaran (nama, urutan) VALUES
  ('Makan Luar', 1),
  ('Jajan Online', 2),
  ('Transportasi', 3),
  ('Tagihan & Langganan', 4),
  ('Hiburan', 5),
  ('Kesehatan', 6),
  ('Perawatan Diri', 7),
  ('Hadiah & Sosial', 8),
  ('Pendidikan', 9),
  ('Rumah Tangga', 10),
  ('Tak Terduga', 11)
ON CONFLICT (nama) DO NOTHING;
