-- 009_fix_mustahiq_mufatish.sql
-- Tabel penugasan Mustahiq per bagian & Mufatish per tingkatan + tautan ke users
-- dan tahun ajaran.
--
-- Catatan: pada versi awal proyek, tabel mustahiq_bagian & mufatish_tingkatan
-- dibuat manual di luar migrasi. Agar deploy fresh berjalan, CREATE dibuat di sini
-- secara idempoten (IF NOT EXISTS) sebelum penambahan kolom.

-- 0. Pastikan tabel dasar ada (fresh deploy).
CREATE TABLE IF NOT EXISTS mustahiq_bagian (
    id          SERIAL PRIMARY KEY,
    pengajar_id INT NOT NULL REFERENCES pengajar(id) ON DELETE CASCADE,
    bagian_id   INT NOT NULL REFERENCES bagian(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (bagian_id)
);

CREATE TABLE IF NOT EXISTS mufatish_tingkatan (
    id           SERIAL PRIMARY KEY,
    pengajar_id  INT NOT NULL REFERENCES pengajar(id) ON DELETE CASCADE,
    tingkatan_id INT NOT NULL REFERENCES tingkatan(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tingkatan_id)
);

-- 1. mustahiq_bagian: tautan ke users + tahun ajaran
ALTER TABLE mustahiq_bagian ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE mustahiq_bagian ADD COLUMN IF NOT EXISTS tahun_ajaran VARCHAR(9);

-- Backfill user_id dari pengajar yang tertaut ke akun mustahiq.
UPDATE mustahiq_bagian mb
SET user_id = u.id
FROM users u
WHERE u.pengajar_id = mb.pengajar_id AND u.role = 'mustahiq';

UPDATE mustahiq_bagian SET tahun_ajaran = '2024/2025' WHERE tahun_ajaran IS NULL;

-- 2. mufatish_tingkatan
ALTER TABLE mufatish_tingkatan ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE mufatish_tingkatan ADD COLUMN IF NOT EXISTS tahun_ajaran VARCHAR(9);

UPDATE mufatish_tingkatan mt
SET user_id = u.id
FROM users u
WHERE u.pengajar_id = mt.pengajar_id AND u.role = 'mufatish';

UPDATE mufatish_tingkatan SET tahun_ajaran = '2024/2025' WHERE tahun_ajaran IS NULL;
