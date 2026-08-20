-- 028_absensi_manual_index.sql
-- Partial unique index agar ON CONFLICT bisa dipakai untuk upsert absensi manual.
-- Index ini mencegah duplikasi: satu santri hanya boleh punya 1 record manual per tanggal.

CREATE UNIQUE INDEX IF NOT EXISTS uq_absensi_perizinan_manual
    ON absensi_perizinan (santri_id, tanggal)
    WHERE sumber = 'manual';
