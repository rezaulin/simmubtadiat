-- 010_fix_penilaian.sql
-- Reconcile penilaian schema with the official calculation rules and raport format.
-- Idempotent: safe to run on an existing database.

-- =====================================================================
-- 1. mata_pelajaran: mapel terikat ke BAGIAN (bukan angkatan/tingkatan),
--    tambah kolom nama_kitab (الكتب الدراسية) & kategori.
--    nama_mapel dipakai sebagai nama fann (الفنون).
-- =====================================================================
ALTER TABLE mata_pelajaran ADD COLUMN IF NOT EXISTS nama_kitab VARCHAR(255);
ALTER TABLE mata_pelajaran ADD COLUMN IF NOT EXISTS kategori VARCHAR(50) NOT NULL DEFAULT 'umum';

-- Batasi nilai kategori yang valid.
-- Kategori 'akhlaq_perilaku' = baris الأخلاق (perilaku) yang bisa diturunkan oleh absensi.
-- Kategori 'akhlaq' = mapel علم الأخلاق (pelajaran biasa, tanpa koreksi absensi).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE constraint_name = 'mata_pelajaran_kategori_check'
    ) THEN
        ALTER TABLE mata_pelajaran
            ADD CONSTRAINT mata_pelajaran_kategori_check
            CHECK (kategori IN ('al_quran', 'al_khot_imla', 'qiroah_kutub', 'muhafadhoh', 'akhlaq', 'akhlaq_perilaku', 'umum'));
    END IF;
END $$;

-- =====================================================================
-- 2. nilai_am: Nilai 'Am adalah RATA-RATA KELAS per mata pelajaran
--    (satu angka per bagian+mapel+semester), bukan per siswi.
-- =====================================================================
ALTER TABLE nilai_am ADD COLUMN IF NOT EXISTS mapel_id INT REFERENCES mata_pelajaran(id) ON DELETE CASCADE;

-- santri_id tidak lagi wajib (Nilai 'Am adalah nilai kelas, bukan individu).
ALTER TABLE nilai_am ALTER COLUMN santri_id DROP NOT NULL;

-- Ganti unique lama (per siswi) menjadi per (bagian, mapel, semester).
ALTER TABLE nilai_am DROP CONSTRAINT IF EXISTS nilai_am_santri_id_bagian_id_semester_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'nilai_am_bagian_mapel_semester_key'
    ) THEN
        ALTER TABLE nilai_am
            ADD CONSTRAINT nilai_am_bagian_mapel_semester_key UNIQUE (bagian_id, mapel_id, semester);
    END IF;
END $$;

-- =====================================================================
-- 3. nilai_bayan: pastikan kolom nilai_angka & nilai_label ada
--    (model laporan.go memakai nama ini; migrasi awal memakai kategori_id/label_arab).
-- =====================================================================
ALTER TABLE nilai_bayan ADD COLUMN IF NOT EXISTS nilai_angka INT;
ALTER TABLE nilai_bayan ADD COLUMN IF NOT EXISTS nilai_label VARCHAR(100);

-- =====================================================================
-- 4. nilai_khos: pastikan kolom tahun_ajaran ada (dipakai rekap nilai kelas).
-- =====================================================================
ALTER TABLE nilai_khos ADD COLUMN IF NOT EXISTS tahun_ajaran VARCHAR(9);
