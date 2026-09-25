-- Expand santri.nik column to accommodate alumni manual NIK format
-- Format: ALM_{stambuk}_{timestamp} can exceed old varchar(16) limit
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'santri' AND column_name = 'nik'
    AND character_maximum_length >= 50
  ) THEN
    ALTER TABLE santri ALTER COLUMN nik TYPE varchar(50);
  END IF;
END $$;

-- Add unique constraint on stambuk for ON CONFLICT (stambuk) in alumni manual insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'santri_stambuk_unique'
  ) THEN
    ALTER TABLE santri ADD CONSTRAINT santri_stambuk_unique UNIQUE (stambuk);
  END IF;
END $$;
