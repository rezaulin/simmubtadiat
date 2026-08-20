-- 046_hijri_semester_map.sql
-- Opsi 1: mapping manual bulan Hijriyah -> semester.
-- Bulan Hijri absolut (tahun_hijri, bulan_hijri) hanya terjadi sekali,
-- sehingga mapping deterministik dan tidak perlu konversi ke Masehi.

-- 1. Tabel mapping: satu baris = satu bulan Hijri absolut -> semester (1/2).
CREATE TABLE IF NOT EXISTS hijri_semester_map (
    tahun_hijri  INTEGER NOT NULL,
    bulan_hijri  INTEGER NOT NULL CHECK (bulan_hijri BETWEEN 1 AND 12),
    semester     SMALLINT NOT NULL CHECK (semester IN (1, 2)),
    tahun_ajaran VARCHAR(9),                 -- opsional: referensi tahun ajaran terkait
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tahun_hijri, bulan_hijri)
);

-- 2. Kolom semester pada absensi manual santri & pengajar.
--    NULL = belum ter-mapping (menunggu admin mengisi mapping).
ALTER TABLE absensi_manual_bulanan
    ADD COLUMN IF NOT EXISTS semester SMALLINT CHECK (semester IN (1, 2));
ALTER TABLE absensi_manual_pengajar_bulanan
    ADD COLUMN IF NOT EXISTS semester SMALLINT CHECK (semester IN (1, 2));

CREATE INDEX IF NOT EXISTS idx_absensi_manual_bln_semester
    ON absensi_manual_bulanan(tahun_ajaran, semester);
CREATE INDEX IF NOT EXISTS idx_absensi_manual_pengajar_semester
    ON absensi_manual_pengajar_bulanan(tahun_ajaran, semester);

-- 3. Backfill: isi semester baris lama dari mapping (idempotent).
UPDATE absensi_manual_bulanan am
   SET semester = m.semester
  FROM hijri_semester_map m
 WHERE am.tahun_hijri = m.tahun_hijri
   AND am.bulan_hijri = m.bulan_hijri
   AND am.semester IS DISTINCT FROM m.semester;

UPDATE absensi_manual_pengajar_bulanan am
   SET semester = m.semester
  FROM hijri_semester_map m
 WHERE am.tahun_hijri = m.tahun_hijri
   AND am.bulan_hijri = m.bulan_hijri
   AND am.semester IS DISTINCT FROM m.semester;
