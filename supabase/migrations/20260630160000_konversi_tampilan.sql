-- ============================================================
-- Konversi: satuan TAMPILAN per barang
-- ------------------------------------------------------------
-- Stok disimpan dalam satuan dasar (mis. kg), tapi rumah tangga biasa melihat
-- satuan pakai (mis. butir). Tandai satu konversi sebagai "tampilan" → UI stok
-- menampilkan saldo dalam satuan itu (jumlah_dasar / faktor). Bila item tak
-- punya satuan tampilan, UI memakai satuan dasar.
-- ============================================================

ALTER TABLE public.item_konversi
  ADD COLUMN tampilan BOOLEAN NOT NULL DEFAULT false;

-- Maksimal satu satuan tampilan per (keluarga, item).
CREATE UNIQUE INDEX uq_item_konversi_tampilan
  ON public.item_konversi (keluarga_id, item_id) WHERE tampilan;

-- Backfill: untuk item yang sudah punya konversi, jadikan yang paling granular
-- (faktor terkecil = satuan terkecil, mis. butir) sebagai satuan tampilan.
UPDATE public.item_konversi k SET tampilan = true
FROM (
  SELECT DISTINCT ON (keluarga_id, item_id) id
  FROM public.item_konversi
  ORDER BY keluarga_id, item_id, faktor ASC
) p
WHERE k.id = p.id;
