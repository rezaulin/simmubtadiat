-- 028_absensi_manual_bulanan.sql
-- Redesign absensi manual: input total S/I/A per bulan Hijriyah (bukan per tanggal).
-- Satuan: HARI. Penilaian membaca data ini langsung tanpa konversi.

-- Hapus partial index lama yang tidak terpakai (jika ada dari deploy sebelumnya).
DROP INDEX IF EXISTS uq_absensi_perizinan_manual;

-- 1. Tabel absensi manual bulanan santri.
CREATE TABLE IF NOT EXISTS absensi_manual_bulanan (
    id           SERIAL PRIMARY KEY,
    santri_id    INTEGER NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    tahun_hijri  INTEGER NOT NULL,           -- e.g. 1447
    bulan_hijri  INTEGER NOT NULL CHECK (bulan_hijri BETWEEN 1 AND 12),
    tahun_ajaran VARCHAR(9) NOT NULL,        -- e.g. '2025/2026' — untuk join ke penilaian
    total_sakit  INTEGER NOT NULL DEFAULT 0,
    total_izin   INTEGER NOT NULL DEFAULT 0,
    total_alpha  INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (santri_id, tahun_hijri, bulan_hijri)
);

CREATE INDEX IF NOT EXISTS idx_absensi_manual_bln_santri ON absensi_manual_bulanan(santri_id, tahun_ajaran);

-- 2. Tabel absensi manual bulanan pengajar.
CREATE TABLE IF NOT EXISTS absensi_manual_pengajar_bulanan (
    id           SERIAL PRIMARY KEY,
    pengajar_id  INTEGER NOT NULL REFERENCES pengajar(id) ON DELETE CASCADE,
    tahun_hijri  INTEGER NOT NULL,
    bulan_hijri  INTEGER NOT NULL CHECK (bulan_hijri BETWEEN 1 AND 12),
    tahun_ajaran VARCHAR(9) NOT NULL,
    total_sakit  INTEGER NOT NULL DEFAULT 0,
    total_izin   INTEGER NOT NULL DEFAULT 0,
    total_alpha  INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pengajar_id, tahun_hijri, bulan_hijri)
);

CREATE INDEX IF NOT EXISTS idx_absensi_manual_bln_pengajar ON absensi_manual_pengajar_bulanan(pengajar_id, tahun_ajaran);
