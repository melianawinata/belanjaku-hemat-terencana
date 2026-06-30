-- ============================================================
-- Integrasi: MENU DIMASAK -> STOK KELUAR (otomatis)
-- ------------------------------------------------------------
-- Saat sebuah rencana_makan ditandai `dimasak_at`, bahan masakannya
-- (menu_komponen tipe 'belanja') dikurangi dari stok sebesar jumlah × porsi.
-- Mutasi: tipe 'keluar', sumber 'menu', ref_id = rencana_makan.id.
-- Idempoten via unique index uq_stok_mutasi_ref(sumber, ref_id, item_key);
-- komponen dengan barang sama diagregasi (SUM) agar item_key tak bentrok.
--
-- Transisi (trigger AFTER pada rencana_makan):
--   * belum->sudah dimasak : kurangi stok (mutasi keluar per bahan).
--   * sudah->belum dimasak  : kembalikan (hapus mutasi).
--   * ubah porsi saat 'sudah dimasak' : hitung ulang.
--   * hapus rencana yg sudah dimasak  : kembalikan.
-- ============================================================

ALTER TABLE public.rencana_makan
  ADD COLUMN dimasak_at TIMESTAMPTZ;

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

  -- Hitung ulang bila porsi berubah selagi tetap "sudah dimasak".
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
      SUM(k.jumlah * NEW.porsi),
      (array_agg(k.satuan))[1],
      'menu',
      NEW.id
    FROM public.menu_komponen k
    WHERE k.menu_id = NEW.menu_id AND k.tipe = 'belanja'
    GROUP BY COALESCE(k.item_id::text, 'free:' || lower(btrim(k.nama)))
    HAVING SUM(k.jumlah * NEW.porsi) <> 0
    ON CONFLICT (sumber, ref_id, item_key) WHERE ref_id IS NOT NULL DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_rencana_makan_ke_stok
  AFTER INSERT OR UPDATE OR DELETE ON public.rencana_makan
  FOR EACH ROW EXECUTE FUNCTION public.rencana_makan_ke_stok();
