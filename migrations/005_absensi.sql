-- 005_absensi.sql
-- Absensi: Kalender, Absensi Harian, Rekap

CREATE TABLE kalender_kuartal (
    id          SERIAL PRIMARY KEY,
    kuartal     INT NOT NULL CHECK (kuartal IN (1, 2, 3, 4)),
    tahun_ajaran VARCHAR(9) NOT NULL,
    tgl_mulai   DATE NOT NULL,
    tgl_selesai DATE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (kuartal, tahun_ajaran)
);

CREATE TABLE absensi_perizinan (
    id          SERIAL PRIMARY KEY,
    santri_id   INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    tanggal     DATE NOT NULL,
    is_alpha    BOOLEAN NOT NULL DEFAULT FALSE, -- FALSE = Bi Idzni, TRUE = Bi Ghoirihi
    keterangan  TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (santri_id, tanggal)
);

CREATE TABLE rekap_absensi (
    id          SERIAL PRIMARY KEY,
    santri_id   INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    kuartal_id  INT NOT NULL REFERENCES kalender_kuartal(id) ON DELETE CASCADE,
    total_izin  INT NOT NULL DEFAULT 0, -- Bi Idzni
    total_alpha INT NOT NULL DEFAULT 0, -- Bi Ghoirihi
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (santri_id, kuartal_id)
);
