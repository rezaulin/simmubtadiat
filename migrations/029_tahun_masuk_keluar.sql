-- 029_tahun_masuk_keluar.sql
-- Tambah kolom tahun_masuk dan tahun_keluar di tabel santri.
-- tahun_masuk otomatis terisi saat insert, tahun_keluar terisi saat proses keluar.

ALTER TABLE santri ADD COLUMN IF NOT EXISTS tahun_masuk VARCHAR(4);
ALTER TABLE santri ADD COLUMN IF NOT EXISTS tahun_keluar VARCHAR(4);

-- Backfill tahun_masuk dari created_at untuk data yang sudah ada.
UPDATE santri SET tahun_masuk = EXTRACT(YEAR FROM created_at)::TEXT WHERE tahun_masuk IS NULL;

-- Backfill tahun_keluar dari proses_keluar untuk santri yang sudah keluar.
UPDATE santri s
SET tahun_keluar = EXTRACT(YEAR FROM pk.tanggal_keluar)::TEXT
FROM proses_keluar pk
WHERE pk.santri_id = s.id AND s.tahun_keluar IS NULL;
