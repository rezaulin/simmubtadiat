-- Expand santri.nik column to accommodate alumni manual NIK format
-- Format: ALM_{stambuk}_{timestamp} can exceed old varchar(16) limit
ALTER TABLE santri ALTER COLUMN nik TYPE varchar(50);

-- Add unique constraint on stambuk for ON CONFLICT (stambuk) in alumni manual insert
ALTER TABLE santri ADD CONSTRAINT santri_stambuk_unique UNIQUE (stambuk);
