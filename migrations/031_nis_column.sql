-- 031_nis_column.sql
-- Tambah kolom NIS (Nomor Induk Siswa) terpisah dari nomor_stambuk.
-- NIS = nomor induk internal madrasah, nomor_stambuk = nomor stambuk resmi.

ALTER TABLE santri ADD COLUMN IF NOT EXISTS nis VARCHAR(20);
