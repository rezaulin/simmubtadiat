-- 039_mufatish_kelas.sql
-- Ubah penugasan mufatish dari per-bagian ke per-kelas.

CREATE TABLE IF NOT EXISTS mufatish_kelas (
    id            SERIAL PRIMARY KEY,
    pengajar_id   INT REFERENCES pengajar(id) ON DELETE CASCADE,
    kelas_id      INT REFERENCES kelas(id) ON DELETE CASCADE,
    tingkatan_id  INT REFERENCES tingkatan(id) ON DELETE CASCADE,
    user_id       INT REFERENCES users(id) ON DELETE SET NULL,
    tahun_ajaran  VARCHAR(20),
    created_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE(kelas_id, tingkatan_id)
);

-- Migrasi: ambil 1 mufatish per kombinasi kelas+tingkatan dari data lama
INSERT INTO mufatish_kelas (pengajar_id, kelas_id, tingkatan_id, user_id, tahun_ajaran)
SELECT DISTINCT ON (b.kelas_id, b.tingkatan_id)
       mb.pengajar_id, b.kelas_id, b.tingkatan_id, mb.user_id, mb.tahun_ajaran
FROM mufatish_bagian mb
JOIN bagian b ON mb.bagian_id = b.id
ORDER BY b.kelas_id, b.tingkatan_id, mb.created_at DESC
ON CONFLICT DO NOTHING;

-- Hapus tabel lama
DROP TABLE IF EXISTS mufatish_bagian CASCADE;
