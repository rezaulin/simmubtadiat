-- 036_mapel_aktif_semester.sql
-- Menandai semester aktif per mapel: 0 = kedua semester (default), 1 = hanya smt 1, 2 = hanya smt 2.

ALTER TABLE mata_pelajaran ADD COLUMN IF NOT EXISTS aktif_semester INT NOT NULL DEFAULT 0;
ALTER TABLE mata_pelajaran DROP CONSTRAINT IF EXISTS chk_aktif_semester;
ALTER TABLE mata_pelajaran ADD CONSTRAINT chk_aktif_semester CHECK (aktif_semester IN (0, 1, 2));
