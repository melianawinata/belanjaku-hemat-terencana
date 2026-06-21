-- Fase 3 Pengeluaran Lain: metode bayar + pengeluaran rutin/berulang (langganan, tagihan)
-- yang bisa di-generate otomatis tiap bulan ke pengeluaran_lain.

-- ============ METODE BAYAR pada entri pengeluaran ============
ALTER TABLE public.pengeluaran_lain ADD COLUMN metode_bayar TEXT;

-- ============ PENGELUARAN RUTIN (template milik user) ============
CREATE TABLE public.pengeluaran_rutin (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kategori_pengeluaran_id UUID REFERENCES public.kategori_pengeluaran(id) ON DELETE SET NULL,
  deskripsi TEXT NOT NULL DEFAULT '',
  nominal NUMERIC NOT NULL DEFAULT 0,
  tanggal_hari INT NOT NULL DEFAULT 1 CHECK (tanggal_hari BETWEEN 1 AND 28),
  metode_bayar TEXT,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pengeluaran_rutin TO authenticated;
GRANT ALL ON public.pengeluaran_rutin TO service_role;
ALTER TABLE public.pengeluaran_rutin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lihat pengeluaran rutin sendiri" ON public.pengeluaran_rutin FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Kelola pengeluaran rutin sendiri" ON public.pengeluaran_rutin FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tautkan entri yang dihasilkan dari template rutin agar tidak dobel saat di-generate ulang.
ALTER TABLE public.pengeluaran_lain ADD COLUMN rutin_id UUID REFERENCES public.pengeluaran_rutin(id) ON DELETE SET NULL;
