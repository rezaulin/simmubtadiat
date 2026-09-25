-- Expand santri.nik column to accommodate alumni manual NIK format
-- Format: ALM_{stambuk}_{timestamp} can exceed old varchar(16) limit
ALTER TABLE santri ALTER COLUMN nik TYPE varchar(50);
