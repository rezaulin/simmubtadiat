-- 027_absensi_manual.sql
-- Absensi manual harian: kolom sumber di absensi_perizinan + tabel absensi_pengajar.

-- 1. Kolom sumber pada absensi_perizinan: 'ustadz' (default, dari input per-jam) atau 'manual'.
ALTER TABLE absensi_perizinan ADD COLUMN IF NOT EXISTS sumber VARCHAR(10) DEFAULT 'ustadz';

-- 2. Tabel absensi pengajar (harian, manual oleh admin).
CREATE TABLE IF NOT EXISTS absensi_pengajar (
    id          SERIAL PRIMARY KEY,
    pengajar_id INTEGER NOT NULL REFERENCES pengajar(id),
    tanggal     DATE NOT NULL,
    status      VARCHAR(10) NOT NULL CHECK (status IN ('izin','sakit','alpha')),
    keterangan  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pengajar_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_absensi_pengajar_tgl ON absensi_pengajar(tanggal);
