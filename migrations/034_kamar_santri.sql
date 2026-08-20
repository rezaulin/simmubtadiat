-- 034_kamar_santri.sql
ALTER TABLE santri ADD COLUMN IF NOT EXISTS kamar VARCHAR(100);
