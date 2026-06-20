-- Tambah dukungan merk/varian: satu item (mis. Beras) bisa punya beberapa merk
-- dengan harga berbeda dalam satu daftar belanja bulanan.

-- Merk per baris belanja
ALTER TABLE public.belanja_item ADD COLUMN merk TEXT;

-- Merk pada histori harga agar estimasi harga akurat per varian
ALTER TABLE public.histori_harga ADD COLUMN merk TEXT;
