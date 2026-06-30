-- ============================================================
-- Belanja Tambahan — pembelian susulan di luar daftar rutin
-- ------------------------------------------------------------
-- Kasus: belanja bulanan rutin sudah selesai, lalu seminggu kemudian ada barang
-- kurang (mis. telur) dan harus beli lagi. Dicatat sebagai belanja_item biasa
-- pada belanja_bulanan periode berjalan, ditandai flag `tambahan` dan langsung
-- `sudah_dibeli` → otomatis:
--   * masuk stok (trigger belanja_item_ke_stok yang sudah ada), dan
--   * terhitung realisasi & budget bulan ini (dashboard/budget menjumlah
--     harga_aktual semua item sudah_dibeli, tanpa filter).
-- Tidak butuh tabel/trigger/RLS baru — memakai ulang belanja_item.
-- Layar Belanja Bulanan memfilter tambahan=false agar daftar rencana tetap bersih.
-- ============================================================

ALTER TABLE public.belanja_item
  ADD COLUMN tambahan BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_belanja_item_tambahan ON public.belanja_item (belanja_id, tambahan);
