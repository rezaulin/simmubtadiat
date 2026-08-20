-- 026_mudir_tanda_tangan.sql
-- Tanda tangan digital Mudir (مدير المعهد) per tingkatan, tampil di raport semester 2.
-- Disimpan sebagai data URL (base64 PNG) di DB agar tidak ikut terhapus saat
-- `npm run build` mengosongkan folder public/dist.

ALTER TABLE mudir_tingkatan ADD COLUMN IF NOT EXISTS tanda_tangan TEXT;
