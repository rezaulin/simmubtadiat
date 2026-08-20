-- 044_pengajar_purna.sql
-- Data Pengajar Purna: arsip pengajar lama (mustahiq/munawwib) yang sudah tidak
-- aktif mengajar. Tabel terpisah dari `pengajar` karena data ini bersifat historis
-- (di-import massal, tidak pernah aktif di sistem) dan menyimpan tahun keluar +
-- wilayah berjenjang (provinsi/kabupaten) yang tidak ada di tabel `pengajar`.
-- Hanya dapat diakses admin & pimpinan (RBAC di router).

CREATE TABLE IF NOT EXISTS pengajar_purna (
    id              SERIAL PRIMARY KEY,
    nama            VARCHAR(255) NOT NULL,
    status          VARCHAR(20),            -- 'mustahiq' | 'munawwib'
    ttl             VARCHAR(255),           -- tempat, tanggal lahir (teks bebas)
    nama_wali       VARCHAR(255),
    no_hp           VARCHAR(30),
    alamat          TEXT,
    tahun_mengajar  VARCHAR(20),            -- tahun mulai mengajar (= "tahun masuk" pada filter)
    tahun_keluar    VARCHAR(20),            -- tahun berhenti mengajar
    provinsi_kode   VARCHAR(2),
    provinsi_nama   VARCHAR(255),
    kabupaten_kode  VARCHAR(5),
    kabupaten_nama  VARCHAR(255),
    is_active       BOOLEAN DEFAULT true,   -- false = soft delete
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pengajar_purna_provinsi ON pengajar_purna(provinsi_kode);
CREATE INDEX IF NOT EXISTS idx_pengajar_purna_kabupaten ON pengajar_purna(kabupaten_kode);
CREATE INDEX IF NOT EXISTS idx_pengajar_purna_status ON pengajar_purna(status);
CREATE INDEX IF NOT EXISTS idx_pengajar_purna_aktif ON pengajar_purna(is_active);
