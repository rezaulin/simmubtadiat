-- 006_alumni.sql
-- Alumni dan Proses Keluar

CREATE TABLE proses_keluar (
    id              SERIAL PRIMARY KEY,
    santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    tanggal_keluar  DATE NOT NULL,
    status_keluar   VARCHAR(50) NOT NULL CHECK (status_keluar IN ('lulus', 'boyong', 'keluar')),
    alasan          TEXT, -- Wajib untuk boyong/keluar
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alumni (
    id              SERIAL PRIMARY KEY,
    santri_id       INT UNIQUE NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    tahun_lulus     VARCHAR(9), -- Null jika boyong/keluar
    status_khidmah  VARCHAR(50) DEFAULT 'belum',
    status_ijazah   VARCHAR(50) DEFAULT 'belum',
    extra           JSONB,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE riwayat_bagian (
    id              SERIAL PRIMARY KEY,
    santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    bagian_id       INT NOT NULL REFERENCES bagian(id) ON DELETE CASCADE,
    tanggal_mulai   DATE NOT NULL,
    tanggal_selesai DATE,
    keterangan      TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
