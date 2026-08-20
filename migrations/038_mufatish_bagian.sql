-- 038_mufatish_bagian.sql
-- Ubah penugasan mufatish dari per-tingkatan ke per-bagian.

CREATE TABLE IF NOT EXISTS mufatish_bagian (
    id          SERIAL PRIMARY KEY,
    pengajar_id INT REFERENCES pengajar(id) ON DELETE CASCADE,
    bagian_id   INT REFERENCES bagian(id) ON DELETE CASCADE,
    user_id     INT REFERENCES users(id) ON DELETE SET NULL,
    tahun_ajaran VARCHAR(20),
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE(bagian_id)
);

-- Migrasi data lama (jika ada)
INSERT INTO mufatish_bagian (pengajar_id, bagian_id, user_id, tahun_ajaran)
SELECT mt.pengajar_id, b.id, mt.user_id, mt.tahun_ajaran
FROM mufatish_tingkatan mt
JOIN bagian b ON mt.tingkatan_id = b.tingkatan_id
ON CONFLICT (bagian_id) DO NOTHING;

-- Hapus tabel lama
DROP TABLE IF EXISTS mufatish_tingkatan CASCADE;
