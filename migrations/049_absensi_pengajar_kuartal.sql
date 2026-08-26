-- 049: Absensi pengajar berbasis KUARTAL (bukan bulanan).
-- Kolom nilai bebas per grup kuartal: K1, K2&3 (gabung), K4.
-- Owner decision 2026-08: buang model bulanan S/I/T, ganti angka bebas per kuartal.
-- Kolom disamakan dengan model Go (AbsensiPengajarKuartal): kuartal_1 / kuartal_23 / kuartal_4.

CREATE TABLE IF NOT EXISTS absensi_pengajar_kuartal (
    id           SERIAL PRIMARY KEY,
    pengajar_id  INTEGER NOT NULL REFERENCES pengajar(id) ON DELETE CASCADE,
    tahun_ajaran VARCHAR(9) NOT NULL,
    kuartal_1    INTEGER DEFAULT 0,   -- Kuartal 1
    kuartal_23   INTEGER DEFAULT 0,   -- Kuartal 2 & 3 (gabung)
    kuartal_4    INTEGER DEFAULT 0,   -- Kuartal 4
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pengajar_id, tahun_ajaran)
);

CREATE INDEX IF NOT EXISTS idx_absensi_pengajar_kuartal_ta
    ON absensi_pengajar_kuartal (tahun_ajaran);

-- Buang tabel absensi pengajar bulanan lama (owner: "buang saja").
DROP TABLE IF EXISTS absensi_manual_pengajar_bulanan CASCADE;
