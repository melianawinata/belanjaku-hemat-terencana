-- ============================================================
-- Login with Google: lengkapi data profil dari metadata OAuth
-- ------------------------------------------------------------
-- Saat user mendaftar via Google, Supabase mengisi
-- raw_user_meta_data dengan key bawaan Google
-- (full_name / name, avatar_url / picture) — BUKAN 'nama'.
-- Trigger handle_new_user kita perbarui agar:
--   * nama     -> diambil dari 'nama' (signup email), lalu
--                 fallback ke full_name / name (Google).
--   * foto_url -> diambil dari avatar_url / picture (Google).
-- kategori_user_id tetap NULL untuk user Google (tidak dipilih
-- saat OAuth) sehingga profil dianggap "belum lengkap" dan user
-- diarahkan ke halaman Lengkapi Profil.
-- ============================================================

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

  INSERT INTO public.profiles (id, nama, email, kategori_user_id, foto_url)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'nama', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      ''
    ),
    NEW.email,
    _kat,
    COALESCE(
      NEW.raw_user_meta_data->>'foto_url',
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
