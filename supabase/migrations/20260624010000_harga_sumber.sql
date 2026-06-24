-- Lacak asal nilai harga_aktual pada tiap baris belanja agar UI bisa menandai
-- harga yang berasal dari scan struk (vs input manual).
--   NULL     : belum diisi
--   'scan'   : hasil scan struk (AI)
--   'manual' : diisi/diubah manual oleh user
ALTER TABLE public.belanja_item
  ADD COLUMN harga_sumber TEXT
  CHECK (harga_sumber IN ('scan', 'manual'));
