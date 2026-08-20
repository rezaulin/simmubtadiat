-- 013_alamat_wilayah.sql
-- Alamat berjenjang santri (Provinsi -> Kabupaten -> Kecamatan) + desa manual.
-- Referensi wilayah sampai tingkat Kecamatan (Opsi B). Desa diketik manual.

-- =============================================================
-- Tabel referensi wilayah (kode mengikuti kode BPS/Kemendagri)
-- =============================================================
CREATE TABLE IF NOT EXISTS wil_provinsi (
    kode    VARCHAR(2) PRIMARY KEY,
    nama    VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS wil_kabupaten (
    kode            VARCHAR(5) PRIMARY KEY,
    provinsi_kode   VARCHAR(2) NOT NULL REFERENCES wil_provinsi(kode),
    nama            VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS wil_kecamatan (
    kode            VARCHAR(8) PRIMARY KEY,
    kabupaten_kode  VARCHAR(5) NOT NULL REFERENCES wil_kabupaten(kode),
    nama            VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wil_kabupaten_prov ON wil_kabupaten(provinsi_kode);
CREATE INDEX IF NOT EXISTS idx_wil_kecamatan_kab ON wil_kecamatan(kabupaten_kode);
-- Pencarian ketik (case-insensitive prefix/contains) untuk typeahead
CREATE INDEX IF NOT EXISTS idx_wil_provinsi_nama ON wil_provinsi(LOWER(nama));
CREATE INDEX IF NOT EXISTS idx_wil_kabupaten_nama ON wil_kabupaten(LOWER(nama));
CREATE INDEX IF NOT EXISTS idx_wil_kecamatan_nama ON wil_kecamatan(LOWER(nama));

-- =============================================================
-- Kolom alamat berjenjang pada tabel santri
-- Kolom `alamat` yang sudah ada dipakai untuk alamat tambahan
-- (jalan / RT / RW / dusun).
-- =============================================================
ALTER TABLE santri ADD COLUMN IF NOT EXISTS provinsi_kode   VARCHAR(2);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS provinsi_nama   VARCHAR(255);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS kabupaten_kode  VARCHAR(5);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS kabupaten_nama  VARCHAR(255);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS kecamatan_kode  VARCHAR(8);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS kecamatan_nama  VARCHAR(255);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS desa            VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_santri_provinsi ON santri(provinsi_kode);
CREATE INDEX IF NOT EXISTS idx_santri_kabupaten ON santri(kabupaten_kode);

-- =============================================================
-- Seed data Provinsi (38 provinsi, kode BPS)
-- =============================================================
INSERT INTO wil_provinsi (kode, nama) VALUES
    ('11', 'Aceh'),
    ('12', 'Sumatera Utara'),
    ('13', 'Sumatera Barat'),
    ('14', 'Riau'),
    ('15', 'Jambi'),
    ('16', 'Sumatera Selatan'),
    ('17', 'Bengkulu'),
    ('18', 'Lampung'),
    ('19', 'Kepulauan Bangka Belitung'),
    ('21', 'Kepulauan Riau'),
    ('31', 'DKI Jakarta'),
    ('32', 'Jawa Barat'),
    ('33', 'Jawa Tengah'),
    ('34', 'DI Yogyakarta'),
    ('35', 'Jawa Timur'),
    ('36', 'Banten'),
    ('51', 'Bali'),
    ('52', 'Nusa Tenggara Barat'),
    ('53', 'Nusa Tenggara Timur'),
    ('61', 'Kalimantan Barat'),
    ('62', 'Kalimantan Tengah'),
    ('63', 'Kalimantan Selatan'),
    ('64', 'Kalimantan Timur'),
    ('65', 'Kalimantan Utara'),
    ('71', 'Sulawesi Utara'),
    ('72', 'Sulawesi Tengah'),
    ('73', 'Sulawesi Selatan'),
    ('74', 'Sulawesi Tenggara'),
    ('75', 'Gorontalo'),
    ('76', 'Sulawesi Barat'),
    ('81', 'Maluku'),
    ('82', 'Maluku Utara'),
    ('91', 'Papua'),
    ('92', 'Papua Barat'),
    ('93', 'Papua Selatan'),
    ('94', 'Papua Tengah'),
    ('95', 'Papua Pegunungan'),
    ('96', 'Papua Barat Daya')
ON CONFLICT (kode) DO NOTHING;
