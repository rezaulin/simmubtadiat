-- 004_nilai.sql
-- Penilaian: Mapel dan Nilai-nilai

CREATE TABLE mata_pelajaran (
    id          SERIAL PRIMARY KEY,
    bagian_id   INT NOT NULL REFERENCES bagian(id) ON DELETE CASCADE,
    nama_mapel  VARCHAR(255) NOT NULL,
    urutan      INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nilai_kuartal (
    id          SERIAL PRIMARY KEY,
    santri_id   INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    mapel_id    INT NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
    kuartal     INT NOT NULL CHECK (kuartal IN (1, 2, 3, 4)),
    nilai       DECIMAL(4,2), -- Supports 7.5 (7½)
    is_her      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (santri_id, mapel_id, kuartal)
);

CREATE TABLE nilai_khos (
    id          SERIAL PRIMARY KEY,
    santri_id   INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    mapel_id    INT NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
    semester    INT NOT NULL CHECK (semester IN (1, 2)),
    nilai_akhir DECIMAL(4,2),
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (santri_id, mapel_id, semester)
);

CREATE TABLE nilai_am (
    id          SERIAL PRIMARY KEY,
    santri_id   INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    bagian_id   INT NOT NULL REFERENCES bagian(id) ON DELETE CASCADE,
    semester    INT NOT NULL CHECK (semester IN (1, 2)),
    nilai_am    DECIMAL(4,2),
    is_edited   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (santri_id, bagian_id, semester)
);

CREATE TABLE nilai_bayan (
    id          SERIAL PRIMARY KEY,
    santri_id   INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    bagian_id   INT NOT NULL REFERENCES bagian(id) ON DELETE CASCADE,
    tahun_ajaran VARCHAR(9) NOT NULL,
    kategori_id INT NOT NULL, -- 9, 8, 7, 6, 5
    label_arab  VARCHAR(100), -- Al-Jayyid Al-Awwal dsb
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (santri_id, bagian_id, tahun_ajaran)
);
