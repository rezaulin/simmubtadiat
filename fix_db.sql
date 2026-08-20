ALTER TABLE santri ADD COLUMN IF NOT EXISTS last_bagian_id INT;
ALTER TABLE santri ADD COLUMN IF NOT EXISTS last_tahun_ajaran VARCHAR(50);

-- Update santri yang saat ini berstatus non-aktif agar last_bagian_id nya terisi otomatis dari riwayat kelas terakhirnya
UPDATE santri s
SET last_bagian_id = (
    SELECT bagian_id 
    FROM riwayat_bagian rb 
    WHERE rb.santri_id = s.id 
    ORDER BY tanggal_mulai DESC LIMIT 1
)
WHERE status != 'aktif' AND last_bagian_id IS NULL;
