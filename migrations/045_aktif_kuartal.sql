-- 045_aktif_kuartal.sql
-- Ganti kontrol aktif per-semester → per-kwartal.
-- aktif_kuartal: JSONB array berisi kwartal aktif, mis. [1,2,3,4] atau [3].

-- 1. Tambah kolom baru dengan default semua kwartal aktif.
ALTER TABLE mata_pelajaran ADD COLUMN IF NOT EXISTS aktif_kuartal JSONB NOT NULL DEFAULT '[1,2,3,4]';

-- 2. Migrasi data lama: konversi aktif_semester → aktif_kuartal.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mata_pelajaran' AND column_name = 'aktif_semester') THEN
    UPDATE mata_pelajaran SET aktif_kuartal = '[1,2,3,4]' WHERE aktif_semester = 0;
    UPDATE mata_pelajaran SET aktif_kuartal = '[1,2]'     WHERE aktif_semester = 1;
    UPDATE mata_pelajaran SET aktif_kuartal = '[3,4]'     WHERE aktif_semester = 2;
  END IF;
END $$;

-- 3. Hapus kolom lama + constraint.
ALTER TABLE mata_pelajaran DROP CONSTRAINT IF EXISTS chk_aktif_semester;
ALTER TABLE mata_pelajaran DROP COLUMN IF EXISTS aktif_semester;
