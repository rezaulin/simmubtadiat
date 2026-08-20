-- 047_kalender_semester_hijri.sql
-- Kalender akademik berbasis Hijriyah: mulai & selesai Semester 1 dan 2.
-- Menggantikan input tanggal-Masehi per kuartal dan mapping bulan terpisah.
--
-- Sumber kebenaran = tanggal Hijriyah (diisi admin). Ekuivalen Masehi
-- (masehi_mulai/selesai) dihitung frontend (Intl islamic-umalqura, WIB) dan
-- disimpan untuk lookup absensi sesi yang memakai tanggal Masehi.

CREATE TABLE IF NOT EXISTS kalender_semester_hijri (
    tahun_ajaran       VARCHAR(9) NOT NULL,
    semester           SMALLINT NOT NULL CHECK (semester IN (1, 2)),
    mulai_tahun_hijri  INTEGER NOT NULL,
    mulai_bulan_hijri  INTEGER NOT NULL CHECK (mulai_bulan_hijri BETWEEN 1 AND 12),
    mulai_tanggal      INTEGER NOT NULL CHECK (mulai_tanggal BETWEEN 1 AND 30),
    selesai_tahun_hijri INTEGER NOT NULL,
    selesai_bulan_hijri INTEGER NOT NULL CHECK (selesai_bulan_hijri BETWEEN 1 AND 12),
    selesai_tanggal    INTEGER NOT NULL CHECK (selesai_tanggal BETWEEN 1 AND 30),
    masehi_mulai       DATE,
    masehi_selesai     DATE,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tahun_ajaran, semester)
);

-- Mekanisme mapping bulan terpisah (migration 046) dilebur ke sini.
-- Kolom semester pada tabel absensi manual DIPERTAHANKAN (hasil resolusi).
DROP TABLE IF EXISTS hijri_semester_map;

-- Sinkronisasi awal: turunkan baris kalender_kuartal (kompatibilitas rekap &
-- lock absensi) dari kolom Masehi yang sudah ada, bila ada.
INSERT INTO kalender_kuartal (kuartal, tahun_ajaran, tgl_mulai, tgl_selesai)
SELECT CASE semester WHEN 1 THEN 1 ELSE 3 END, tahun_ajaran, masehi_mulai, masehi_selesai
  FROM kalender_semester_hijri
 WHERE masehi_mulai IS NOT NULL AND masehi_selesai IS NOT NULL
ON CONFLICT (kuartal, tahun_ajaran)
DO UPDATE SET tgl_mulai = EXCLUDED.tgl_mulai, tgl_selesai = EXCLUDED.tgl_selesai;
