-- 023_penilaian_lock.sql
-- Alur kunci & verifikasi nilai per (tahun_ajaran, semester).
-- State: DRAFT -> MASA_KOREKSI -> TERKUNCI.
--   DRAFT        : input bebas (default bila belum ada baris status).
--   MASA_KOREKSI : admin/pimpinan membuka koreksi; mustahiq mengecek & konfirmasi
--                  per bagian (kelasnya). Edit masih diizinkan.
--   TERKUNCI     : semua bagian target terkonfirmasi (atau kunci paksa admin).
--                  Nilai kuartal semester ini + absensi semester read-only;
--                  Khos (semua semester) & Al-Bayan (saat semester 2) auto-generate.

CREATE TABLE IF NOT EXISTS penilaian_status (
    id           SERIAL PRIMARY KEY,
    tahun_ajaran VARCHAR(9) NOT NULL,
    semester     INT NOT NULL CHECK (semester IN (1, 2)),
    status       VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                 CHECK (status IN ('DRAFT', 'MASA_KOREKSI', 'TERKUNCI')),
    opened_by    INT REFERENCES users(id) ON DELETE SET NULL,
    opened_at    TIMESTAMPTZ,
    locked_by    INT REFERENCES users(id) ON DELETE SET NULL,
    locked_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tahun_ajaran, semester)
);

-- Konfirmasi "sudah dikoreksi" per bagian (per mustahiq/walikelas).
CREATE TABLE IF NOT EXISTS penilaian_konfirmasi (
    id           SERIAL PRIMARY KEY,
    tahun_ajaran VARCHAR(9) NOT NULL,
    semester     INT NOT NULL CHECK (semester IN (1, 2)),
    bagian_id    INT NOT NULL REFERENCES bagian(id) ON DELETE CASCADE,
    pengajar_id  INT REFERENCES pengajar(id) ON DELETE SET NULL,
    user_id      INT REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tahun_ajaran, semester, bagian_id)
);

CREATE INDEX IF NOT EXISTS idx_penilaian_konfirmasi_ta_smt
    ON penilaian_konfirmasi (tahun_ajaran, semester);
