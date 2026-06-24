-- Lacak asal nilai estimasi_harga pada tiap baris belanja agar UI bisa
-- menandai harga yang berasal dari perkiraan AI (vs histori user / input manual).
--   NULL      : belum diestimasi / harga 0 bawaan
--   'histori' : diambil dari histori_harga user
--   'ai'      : perkiraan dari AI (Gemini)
--   'manual'  : diisi/diubah manual oleh user
ALTER TABLE public.belanja_item
  ADD COLUMN estimasi_sumber TEXT
  CHECK (estimasi_sumber IN ('histori', 'ai', 'manual'));
