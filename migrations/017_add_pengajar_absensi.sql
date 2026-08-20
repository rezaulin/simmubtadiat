-- 017_add_pengajar_absensi.sql
-- Menambahkan kolom pengajar_id ke tabel absensi_perizinan untuk mencatat log pengajar yang melakukan absensi.
-- IF NOT EXISTS agar aman (migrasi 018 duplikat menambah kolom yang sama).

ALTER TABLE absensi_perizinan ADD COLUMN IF NOT EXISTS pengajar_id INT REFERENCES pengajar(id) ON DELETE SET NULL;
