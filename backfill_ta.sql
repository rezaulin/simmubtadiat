UPDATE santri s
SET last_tahun_ajaran = (
    SELECT tahun_ajaran 
    FROM kalender_kuartal 
    WHERE s.tanggal_status::DATE BETWEEN tgl_mulai AND tgl_selesai 
    LIMIT 1
)
WHERE status != 'aktif' AND last_tahun_ajaran IS NULL AND tanggal_status IS NOT NULL;

UPDATE santri s
SET last_tahun_ajaran = (
    SELECT tahun_ajaran 
    FROM kalender_kuartal 
    ORDER BY tgl_selesai DESC 
    LIMIT 1
)
WHERE status != 'aktif' AND last_tahun_ajaran IS NULL;

