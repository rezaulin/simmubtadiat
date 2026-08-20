-- 002_master.sql
-- Master Data: Tingkatan, Angkatan, Bagian, Santri

CREATE TABLE tingkatan (
    id          SERIAL PRIMARY KEY,
    nama        VARCHAR(255) UNIQUE NOT NULL,
    urutan      INT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE angkatan (
    id          SERIAL PRIMARY KEY,
    nama        VARCHAR(255) UNIQUE NOT NULL,
    tahun_masuk VARCHAR(9) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bagian (
    id              SERIAL PRIMARY KEY,
    angkatan_id     INT NOT NULL REFERENCES angkatan(id),
    tingkatan_id    INT NOT NULL REFERENCES tingkatan(id),
    nama_bagian     VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (angkatan_id, nama_bagian)
);

CREATE TABLE santri (
    id              SERIAL PRIMARY KEY,
    nik             VARCHAR(16) UNIQUE NOT NULL,
    nomor_stambuk   VARCHAR(50) UNIQUE NOT NULL,
    nisn            VARCHAR(20),
    nama            VARCHAR(255) NOT NULL,
    nama_wali       VARCHAR(255),
    ttl_tempat      VARCHAR(255),
    ttl_tanggal     DATE,
    alamat          TEXT,
    no_hp_wali      VARCHAR(20),
    bagian_id       INT REFERENCES bagian(id),
    status          VARCHAR(50) NOT NULL CHECK (status IN ('aktif', 'cuti', 'boyong', 'lulus', 'keluar')),
    foto_url        VARCHAR(255),
    extra           JSONB,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wali_santri_link (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, santri_id)
);
