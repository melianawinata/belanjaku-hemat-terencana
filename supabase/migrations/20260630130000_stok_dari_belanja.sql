-- ============================================================
-- Integrasi: BELANJA -> STOK MASUK (otomatis)
-- ------------------------------------------------------------
-- Saat sebuah belanja_item ditandai `sudah_dibeli`, barangnya otomatis masuk
-- ke stok (stok_mutasi tipe 'masuk', sumber 'belanja', ref_id = belanja_item.id).
-- Idempoten via unique index uq_stok_mutasi_ref(sumber, ref_id, item_key).
--
-- Transisi yang ditangani (trigger AFTER pada belanja_item):
--   * belum->sudah dibeli  : buat mutasi masuk.
--   * sudah->belum dibeli   : tarik kembali (hapus mutasi).
--   * hapus item yg sudah dibeli : tarik kembali.
--   * ubah jumlah/satuan saat masih 'sudah dibeli' : saldo ikut disesuaikan.
--
-- SECURITY DEFINER: menulis stok_mutasi lintas-RLS dengan keluarga_id yang
-- divalidasi dari belanja_bulanan pemilik item.
-- ============================================================

CREATE OR REPLACE FUNCTION public.belanja_item_ke_stok()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _kel UUID;
BEGIN
  -- Hapus item: tarik stok jika item itu sudah pernah dibeli.
  IF TG_OP = 'DELETE' THEN
    IF OLD.sudah_dibeli THEN
      DELETE FROM public.stok_mutasi WHERE sumber = 'belanja' AND ref_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  SELECT keluarga_id INTO _kel FROM public.belanja_bulanan WHERE id = NEW.belanja_id;
  IF _kel IS NULL THEN
    RETURN NEW; -- belanja tanpa keluarga (tak seharusnya terjadi): lewati.
  END IF;

  -- belum -> sudah dibeli : masukkan ke stok (idempoten).
  IF NEW.sudah_dibeli AND (TG_OP = 'INSERT' OR NOT OLD.sudah_dibeli) THEN
    IF NEW.jumlah <> 0 THEN
      INSERT INTO public.stok_mutasi
        (keluarga_id, user_id, item_id, nama, kategori_barang_id, tipe, jumlah, satuan, sumber, ref_id)
      VALUES
        (_kel, NEW.user_id, NEW.item_id, NEW.nama_snapshot, NEW.kategori_barang_id,
         'masuk', NEW.jumlah, NEW.satuan, 'belanja', NEW.id)
      ON CONFLICT (sumber, ref_id, item_key) WHERE ref_id IS NOT NULL DO NOTHING;
    END IF;

  -- sudah -> belum dibeli : tarik kembali.
  ELSIF TG_OP = 'UPDATE' AND OLD.sudah_dibeli AND NOT NEW.sudah_dibeli THEN
    DELETE FROM public.stok_mutasi WHERE sumber = 'belanja' AND ref_id = NEW.id;

  -- tetap 'sudah dibeli' tapi jumlah/satuan berubah : sinkronkan saldo.
  -- (identitas barang tidak diubah di sini agar item_key tetap konsisten.)
  ELSIF TG_OP = 'UPDATE' AND NEW.sudah_dibeli AND OLD.sudah_dibeli
        AND (NEW.jumlah IS DISTINCT FROM OLD.jumlah OR NEW.satuan IS DISTINCT FROM OLD.satuan) THEN
    UPDATE public.stok_mutasi
      SET jumlah = NEW.jumlah, satuan = NEW.satuan
      WHERE sumber = 'belanja' AND ref_id = NEW.id;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_belanja_item_ke_stok
  AFTER INSERT OR UPDATE OR DELETE ON public.belanja_item
  FOR EACH ROW EXECUTE FUNCTION public.belanja_item_ke_stok();
