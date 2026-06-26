-- ============================================================
-- Langganan berbayar (Midtrans) — fase 1: bayar per periode
-- ------------------------------------------------------------
-- Tiga tabel:
--   * subscription_plans   : master paket (plus/keluarga) + harga.
--                            Dibaca publik (landing page & checkout).
--   * payment_transactions : satu baris per percobaan bayar (order).
--                            Sumber audit + status dari webhook Midtrans.
--   * user_subscriptions   : satu baris per periode aktif yang diberikan.
--                            "Plan aktif" = baris status='active' &
--                            period_end masih di masa depan.
--
-- Prinsip: akses ditentukan webhook (settlement/capture), BUKAN callback
-- browser. Tulis dari webhook memakai service_role (bypass RLS).
-- ============================================================

-- ============ MASTER PAKET ============
CREATE TABLE public.subscription_plans (
  code TEXT NOT NULL PRIMARY KEY,            -- 'plus' | 'keluarga'
  nama TEXT NOT NULL,
  harga_bulanan NUMERIC NOT NULL CHECK (harga_bulanan >= 0),
  harga_tahunan NUMERIC NOT NULL CHECK (harga_tahunan >= 0),  -- total per tahun
  urutan INT NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paket aktif bisa dibaca publik" ON public.subscription_plans
  FOR SELECT TO anon, authenticated USING (aktif);

-- Seed paket sesuai landing page (#harga). harga_tahunan = harga bulanan
-- diskon ~20% lalu dikali 12 (Plus: 15.200*12, Keluarga: 23.200*12).
INSERT INTO public.subscription_plans (code, nama, harga_bulanan, harga_tahunan, urutan) VALUES
  ('plus',     'Plus',     19000, 182400, 1),
  ('keluarga', 'Keluarga', 29000, 278400, 2);

-- ============ TRANSAKSI PEMBAYARAN ============
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,             -- di-generate aplikasi, dikirim ke Midtrans
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES public.subscription_plans(code),
  cycle TEXT NOT NULL DEFAULT 'bulanan' CHECK (cycle IN ('bulanan', 'tahunan')),
  gross_amount NUMERIC NOT NULL CHECK (gross_amount >= 0),
  -- status internal aplikasi
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'expired', 'failed', 'cancelled')),
  snap_token TEXT,
  midtrans_status TEXT,                       -- transaction_status mentah dari Midtrans
  payment_type TEXT,
  raw_notification JSONB,                     -- payload webhook terakhir (audit)
  expired_at TIMESTAMPTZ,                     -- batas waktu bayar (expiry Snap)
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- User hanya boleh MEMBACA transaksinya sendiri. Penulisan dilakukan
-- server (service_role) lewat server function & webhook, bukan dari client.
CREATE POLICY "Lihat transaksi sendiri" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_payment_transactions_user ON public.payment_transactions (user_id, created_at DESC);

-- ============ LANGGANAN (PERIODE AKTIF) ============
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES public.subscription_plans(code),
  cycle TEXT NOT NULL DEFAULT 'bulanan' CHECK (cycle IN ('bulanan', 'tahunan')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled')),
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_end TIMESTAMPTZ NOT NULL,
  source_order_id TEXT REFERENCES public.payment_transactions(order_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lihat langganan sendiri" ON public.user_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_user_subscriptions_active
  ON public.user_subscriptions (user_id, period_end DESC)
  WHERE status = 'active';

-- ============ HELPER: paket aktif user ============
-- Mengembalikan kode paket aktif terbaru (atau NULL). SECURITY DEFINER
-- agar bisa dipakai di RLS/policy tabel fitur berbayar nanti.
CREATE OR REPLACE FUNCTION public.get_active_plan(_user UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plan_code
  FROM public.user_subscriptions
  WHERE user_id = _user
    AND status = 'active'
    AND period_end > now()
  ORDER BY period_end DESC
  LIMIT 1;
$$;
