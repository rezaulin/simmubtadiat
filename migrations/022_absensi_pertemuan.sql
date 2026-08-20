-- 022_absensi_pertemuan.sql
-- Absensi per-pertemuan (2 pertemuan/hari) + log sesi (bukti kehadiran ustadz).
-- Belum ada data lama yang perlu dipertahankan, jadi absensi direset bersih.

-- 1. Tabel sesi/pertemuan. Satu baris = satu kali pengisian absensi untuk sebuah
--    slot (bagian, tanggal, pertemuan). Menjadi denominator "Hadir" siswa dan
--    bukti "ustadz masuk" (via jadwal_id).
CREATE TABLE IF NOT EXISTS absensi_sesi (
    id          SERIAL PRIMARY KEY,
    bagian_id   INT NOT NULL REFERENCES bagian(id) ON DELETE CASCADE,
    jadwal_id   INT REFERENCES jadwal_pelajaran(id) ON DELETE SET NULL,
    mapel_id    INT REFERENCES mata_pelajaran(id) ON DELETE SET NULL,
    pengajar_id INT REFERENCES pengajar(id) ON DELETE SET NULL,
    tanggal     DATE NOT NULL,
    pertemuan   INT NOT NULL CHECK (pertemuan BETWEEN 1 AND 2),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (bagian_id, tanggal, pertemuan)
);
CREATE INDEX IF NOT EXISTS idx_absensi_sesi_tanggal ON absensi_sesi(tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_sesi_jadwal ON absensi_sesi(jadwal_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_sesi_pengajar ON absensi_sesi(pengajar_id, tanggal);

-- 2. Reset absensi (tidak ada data lama yang dipertahankan) lalu restrukturisasi
--    absensi_perizinan menjadi per-sesi dengan status eksplisit.
TRUNCATE TABLE absensi_perizinan RESTART IDENTITY CASCADE;
TRUNCATE TABLE rekap_absensi RESTART IDENTITY CASCADE;

-- Hanya menyimpan baris NON-hadir, tertaut ke sesi.
ALTER TABLE absensi_perizinan ADD COLUMN IF NOT EXISTS sesi_id INT REFERENCES absensi_sesi(id) ON DELETE CASCADE;
ALTER TABLE absensi_perizinan ADD COLUMN IF NOT EXISTS status VARCHAR(10);

-- Longgarkan kolom lama is_alpha (tetap ada demi kompatibilitas biner lama, tak dipakai lagi).
ALTER TABLE absensi_perizinan ALTER COLUMN is_alpha DROP NOT NULL;

-- Ganti kunci unik: dari (santri_id, tanggal) menjadi (santri_id, sesi_id).
ALTER TABLE absensi_perizinan DROP CONSTRAINT IF EXISTS absensi_perizinan_santri_id_tanggal_key;
ALTER TABLE absensi_perizinan ADD CONSTRAINT absensi_perizinan_santri_sesi_key UNIQUE (santri_id, sesi_id);

-- Batasi nilai status (izin = bi idzni, sakit, alpha = bi ghoiri idzni).
ALTER TABLE absensi_perizinan DROP CONSTRAINT IF EXISTS absensi_perizinan_status_check;
ALTER TABLE absensi_perizinan ADD CONSTRAINT absensi_perizinan_status_check
    CHECK (status IS NULL OR status IN ('izin', 'sakit', 'alpha'));

CREATE INDEX IF NOT EXISTS idx_absensi_perizinan_santri_tanggal ON absensi_perizinan(santri_id, tanggal);

-- 3. rekap_absensi: kolom kini bersatuan PERTEMUAN; tambah total_sakit.
ALTER TABLE rekap_absensi ADD COLUMN IF NOT EXISTS total_sakit INT NOT NULL DEFAULT 0;
