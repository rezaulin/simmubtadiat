-- 003_pengajar.sql
-- SDM: Pengajar, Penugasan, Dewan Harian

CREATE TABLE pengajar (
    id              SERIAL PRIMARY KEY,
    nama            VARCHAR(255) NOT NULL,
    nama_wali       VARCHAR(255),
    ttl_tempat      VARCHAR(255),
    ttl_tanggal     DATE,
    alamat          TEXT,
    no_hp           VARCHAR(20),
    tahun_mengajar  VARCHAR(9),
    status          VARCHAR(50) CHECK (status IN ('mustahiq', 'munawwib')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    extra           JSONB,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tambahkan FK ke users
ALTER TABLE users ADD CONSTRAINT fk_user_pengajar FOREIGN KEY (pengajar_id) REFERENCES pengajar(id) ON DELETE SET NULL;

CREATE TABLE dewan_harian (
    id              SERIAL PRIMARY KEY,
    nama            VARCHAR(255) NOT NULL,
    nama_wali       VARCHAR(255),
    ttl_tempat      VARCHAR(255),
    ttl_tanggal     DATE,
    alamat          TEXT,
    no_hp           VARCHAR(20),
    jabatan         VARCHAR(255) NOT NULL,
    lembaga         VARCHAR(50) NOT NULL CHECK (lembaga IN ('P3HM', 'MPHM', 'M3PHM')),
    tahun_aktif     VARCHAR(9) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    extra           JSONB,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pengajar_bagian (
    id              SERIAL PRIMARY KEY,
    pengajar_id     INT NOT NULL REFERENCES pengajar(id) ON DELETE CASCADE,
    bagian_id       INT NOT NULL REFERENCES bagian(id) ON DELETE CASCADE,
    tahun_ajaran    VARCHAR(9) NOT NULL,
    peran           VARCHAR(50) NOT NULL CHECK (peran IN ('mustahiq', 'munawwib')),
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pengajar_id, bagian_id, tahun_ajaran, peran)
);
