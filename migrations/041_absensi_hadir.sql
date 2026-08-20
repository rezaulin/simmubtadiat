-- 041_absensi_hadir.sql
-- Menambahkan kolom total_hadir untuk mencatat kehadiran siswa dan pengajar.

ALTER TABLE absensi_manual_bulanan ADD COLUMN IF NOT EXISTS total_hadir INTEGER NOT NULL DEFAULT 0;
ALTER TABLE absensi_manual_pengajar_bulanan ADD COLUMN IF NOT EXISTS total_hadir INTEGER NOT NULL DEFAULT 0;
