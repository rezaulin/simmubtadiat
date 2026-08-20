-- 012_tahun_ajaran_konsisten.sql
-- Migration to make tahun_ajaran consistent across all grading tables

-- 1. Insert default active tahun_ajaran into settings
INSERT INTO settings (key, value) VALUES ('tahun_ajaran_aktif', '2026/2027') ON CONFLICT (key) DO NOTHING;

-- 2. Update nilai_kuartal
ALTER TABLE nilai_kuartal ADD COLUMN IF NOT EXISTS tahun_ajaran VARCHAR(9);
-- Update existing rows based on kalender_kuartal
UPDATE nilai_kuartal nk
SET tahun_ajaran = (SELECT tahun_ajaran FROM kalender_kuartal kk WHERE kk.kuartal = nk.kuartal ORDER BY id DESC LIMIT 1)
WHERE tahun_ajaran IS NULL;
-- Set a default fallback if kalender doesn't exist for the kuartal
UPDATE nilai_kuartal SET tahun_ajaran = '2026/2027' WHERE tahun_ajaran IS NULL;
ALTER TABLE nilai_kuartal ALTER COLUMN tahun_ajaran SET NOT NULL;

ALTER TABLE nilai_kuartal DROP CONSTRAINT IF EXISTS nilai_kuartal_santri_id_mapel_id_kuartal_key;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nilai_kuartal_unique') THEN
        ALTER TABLE nilai_kuartal ADD CONSTRAINT nilai_kuartal_unique UNIQUE (santri_id, mapel_id, kuartal, tahun_ajaran);
    END IF;
END $$;


-- 3. Update nilai_khos
-- We already added tahun_ajaran previously, let's fix its constraint
ALTER TABLE nilai_khos DROP CONSTRAINT IF EXISTS nilai_khos_santri_id_mapel_id_semester_key;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nilai_khos_unique') THEN
        ALTER TABLE nilai_khos ADD CONSTRAINT nilai_khos_unique UNIQUE (santri_id, mapel_id, semester, tahun_ajaran);
    END IF;
END $$;


-- 4. Update nilai_am
ALTER TABLE nilai_am ADD COLUMN IF NOT EXISTS tahun_ajaran VARCHAR(9);
-- Guess existing from kalender or default
UPDATE nilai_am SET tahun_ajaran = '2026/2027' WHERE tahun_ajaran IS NULL;
ALTER TABLE nilai_am ALTER COLUMN tahun_ajaran SET NOT NULL;

ALTER TABLE nilai_am DROP CONSTRAINT IF EXISTS nilai_am_bagian_mapel_semester_key;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nilai_am_unique') THEN
        ALTER TABLE nilai_am ADD CONSTRAINT nilai_am_unique UNIQUE (bagian_id, mapel_id, semester, tahun_ajaran);
    END IF;
END $$;
