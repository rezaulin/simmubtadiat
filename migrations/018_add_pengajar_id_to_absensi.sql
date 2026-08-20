-- 018_add_pengajar_id_to_absensi.sql
-- Duplikat historis dari 017 (kolom pengajar_id). Dibuat idempoten agar tidak gagal
-- pada deploy fresh (kolom sudah dibuat oleh 017).

ALTER TABLE absensi_perizinan ADD COLUMN IF NOT EXISTS pengajar_id INT REFERENCES pengajar(id) ON DELETE SET NULL;
