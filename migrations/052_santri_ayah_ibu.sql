-- Tambah kolom nama_ayah dan nama_ibu untuk data orang tua santri.
-- Tahun masuk sebelumnya otomatis (EXTRACT(YEAR FROM CURRENT_DATE)),
-- sekarang menjadi input manual dari user.

ALTER TABLE santri ADD COLUMN IF NOT EXISTS nama_ayah VARCHAR(255);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS nama_ibu VARCHAR(255);
