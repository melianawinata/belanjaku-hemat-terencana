
-- ============ ENUM ROLE ============
CREATE TYPE public.app_role AS ENUM ('customer', 'admin');

-- ============ MASTER: KATEGORI USER ============
CREATE TABLE public.kategori_user (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kategori_user TO authenticated;
GRANT SELECT ON public.kategori_user TO anon;
GRANT ALL ON public.kategori_user TO service_role;
ALTER TABLE public.kategori_user ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL DEFAULT '',
  email TEXT,
  kategori_user_id UUID REFERENCES public.kategori_user(id) ON DELETE SET NULL,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES + has_role ============
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ MASTER: KATEGORI BARANG ============
CREATE TABLE public.kategori_barang (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kategori_barang TO authenticated;
GRANT ALL ON public.kategori_barang TO service_role;
ALTER TABLE public.kategori_barang ENABLE ROW LEVEL SECURITY;

-- ============ MASTER: SATUAN ============
CREATE TABLE public.satuan (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.satuan TO authenticated;
GRANT ALL ON public.satuan TO service_role;
ALTER TABLE public.satuan ENABLE ROW LEVEL SECURITY;

-- ============ MASTER: ITEM ============
CREATE TABLE public.item (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  kategori_barang_id UUID REFERENCES public.kategori_barang(id) ON DELETE SET NULL,
  satuan_default TEXT NOT NULL DEFAULT 'pcs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item TO authenticated;
GRANT ALL ON public.item TO service_role;
ALTER TABLE public.item ENABLE ROW LEVEL SECURITY;

-- ============ MASTER: TOKO ============
CREATE TABLE public.toko (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  tipe TEXT NOT NULL DEFAULT 'Minimarket',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toko TO authenticated;
GRANT ALL ON public.toko TO service_role;
ALTER TABLE public.toko ENABLE ROW LEVEL SECURITY;

-- ============ DEFAULT ITEM KATEGORI ============
CREATE TABLE public.default_item_kategori (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kategori_user_id UUID NOT NULL REFERENCES public.kategori_user(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.item(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kategori_user_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.default_item_kategori TO authenticated;
GRANT ALL ON public.default_item_kategori TO service_role;
ALTER TABLE public.default_item_kategori ENABLE ROW LEVEL SECURITY;

-- ============ ITEM FAVORIT ============
CREATE TABLE public.item_favorit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.item(id) ON DELETE CASCADE,
  jumlah_default NUMERIC NOT NULL DEFAULT 1,
  satuan_default TEXT NOT NULL DEFAULT 'pcs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_favorit TO authenticated;
GRANT ALL ON public.item_favorit TO service_role;
ALTER TABLE public.item_favorit ENABLE ROW LEVEL SECURITY;

-- ============ BELANJA BULANAN ============
CREATE TABLE public.belanja_bulanan (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bulan INT NOT NULL,
  tahun INT NOT NULL,
  budget NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  selesai_at TIMESTAMPTZ,
  UNIQUE (user_id, bulan, tahun)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.belanja_bulanan TO authenticated;
GRANT ALL ON public.belanja_bulanan TO service_role;
ALTER TABLE public.belanja_bulanan ENABLE ROW LEVEL SECURITY;

-- ============ BELANJA ITEM ============
CREATE TABLE public.belanja_item (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  belanja_id UUID NOT NULL REFERENCES public.belanja_bulanan(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.item(id) ON DELETE SET NULL,
  nama_snapshot TEXT NOT NULL,
  kategori_barang_id UUID REFERENCES public.kategori_barang(id) ON DELETE SET NULL,
  jumlah NUMERIC NOT NULL DEFAULT 1,
  satuan TEXT NOT NULL DEFAULT 'pcs',
  estimasi_harga NUMERIC NOT NULL DEFAULT 0,
  harga_aktual NUMERIC,
  toko_id UUID REFERENCES public.toko(id) ON DELETE SET NULL,
  sudah_dibeli BOOLEAN NOT NULL DEFAULT false,
  dibeli_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.belanja_item TO authenticated;
GRANT ALL ON public.belanja_item TO service_role;
ALTER TABLE public.belanja_item ENABLE ROW LEVEL SECURITY;

-- ============ HISTORI HARGA ============
CREATE TABLE public.histori_harga (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.item(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  harga NUMERIC NOT NULL,
  toko_id UUID REFERENCES public.toko(id) ON DELETE SET NULL,
  tanggal TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.histori_harga TO authenticated;
GRANT ALL ON public.histori_harga TO service_role;
ALTER TABLE public.histori_harga ENABLE ROW LEVEL SECURITY;

-- ============ AKTIVITAS ============
CREATE TABLE public.aktivitas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL,
  deskripsi TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aktivitas TO authenticated;
GRANT ALL ON public.aktivitas TO service_role;
ALTER TABLE public.aktivitas ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- kategori_user: public read, admin write
CREATE POLICY "Kategori user dapat dibaca siapa saja" ON public.kategori_user FOR SELECT USING (true);
CREATE POLICY "Admin kelola kategori user" ON public.kategori_user FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "Lihat profil sendiri" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Buat profil sendiri" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Ubah profil sendiri" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "Lihat role sendiri" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- master tables read by authenticated, write by admin
CREATE POLICY "Baca kategori barang" ON public.kategori_barang FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin kelola kategori barang" ON public.kategori_barang FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Baca satuan" ON public.satuan FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin kelola satuan" ON public.satuan FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Baca item" ON public.item FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin kelola item" ON public.item FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Baca toko" ON public.toko FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin kelola toko" ON public.toko FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Baca default item" ON public.default_item_kategori FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin kelola default item" ON public.default_item_kategori FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- item_favorit (user owned)
CREATE POLICY "Kelola favorit sendiri" ON public.item_favorit FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- belanja_bulanan (user owned + admin read)
CREATE POLICY "Lihat belanja sendiri" ON public.belanja_bulanan FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Kelola belanja sendiri" ON public.belanja_bulanan FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- belanja_item
CREATE POLICY "Lihat item belanja sendiri" ON public.belanja_item FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Kelola item belanja sendiri" ON public.belanja_item FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- histori_harga
CREATE POLICY "Lihat histori harga sendiri" ON public.histori_harga FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Kelola histori harga sendiri" ON public.histori_harga FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- aktivitas
CREATE POLICY "Lihat aktivitas sendiri" ON public.aktivitas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Buat aktivitas sendiri" ON public.aktivitas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _kat UUID;
BEGIN
  SELECT id INTO _kat FROM public.kategori_user
    WHERE id = (NEW.raw_user_meta_data->>'kategori_user_id')::uuid;

  INSERT INTO public.profiles (id, nama, email, kategori_user_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama', ''),
    NEW.email,
    _kat
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
