-- 1. Hapus kolom nomor_stambuk lama tanpa migrasi data (sesuai persetujuan user)
ALTER TABLE santri DROP COLUMN IF EXISTS nomor_stambuk;

-- 2. Rename kolom nis → stambuk
ALTER TABLE santri RENAME COLUMN nis TO stambuk;
