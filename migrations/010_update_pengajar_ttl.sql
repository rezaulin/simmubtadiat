-- 010_update_pengajar_ttl.sql

-- Add the new column
ALTER TABLE pengajar ADD COLUMN IF NOT EXISTS ttl VARCHAR(255);

-- Migrate data from the old columns to the new column
UPDATE pengajar 
SET ttl = CASE
    WHEN ttl_tempat IS NOT NULL AND ttl_tanggal IS NOT NULL THEN CONCAT(ttl_tempat, ', ', TO_CHAR(ttl_tanggal, 'DD-MM-YYYY'))
    WHEN ttl_tempat IS NOT NULL AND ttl_tanggal IS NULL THEN ttl_tempat
    WHEN ttl_tempat IS NULL AND ttl_tanggal IS NOT NULL THEN TO_CHAR(ttl_tanggal, 'DD-MM-YYYY')
    ELSE NULL
END;

-- Drop the old columns
ALTER TABLE pengajar DROP COLUMN IF EXISTS ttl_tempat;
ALTER TABLE pengajar DROP COLUMN IF EXISTS ttl_tanggal;
