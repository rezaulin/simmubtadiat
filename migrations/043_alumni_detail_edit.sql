-- 043_alumni_detail_edit.sql
-- Menambahkan kolom untuk override field turunan (asal_daerah, tingkatan_akhir) 
-- dan kolom baru (alasan_ijazah_belum_diambil) di form edit alumni.

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS asal_daerah VARCHAR(255);
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS tingkatan_akhir VARCHAR(255);
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS alasan_ijazah_belum_diambil TEXT;
