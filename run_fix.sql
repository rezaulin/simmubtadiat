
UPDATE santri s
SET last_bagian_id = (
    SELECT b.id 
    FROM bagian b
    WHERE b.tingkatan_id = (SELECT id FROM tingkatan WHERE nama ILIKE '%Aliyah%' LIMIT 1)
      AND b.kelas_id = (SELECT id FROM kelas WHERE nama = '2' LIMIT 1)
    LIMIT 1
)
WHERE status != 'aktif' 
  AND UPPER(nama) IN ('FATHIMAH', 'HANUM MASRUROH', 'HASUNAH', 'PUTRINDA AYU BERLIANI');

UPDATE santri s
SET last_bagian_id = (
    SELECT b.id 
    FROM bagian b
    WHERE b.tingkatan_id = (SELECT id FROM tingkatan WHERE nama ILIKE '%Tsanawiyah%' LIMIT 1)
      AND b.kelas_id = (SELECT id FROM kelas WHERE nama = '3' LIMIT 1)
    LIMIT 1
)
WHERE status != 'aktif' 
  AND UPPER(nama) IN ('AISYAH', 'NADIATUL JINAN');

UPDATE santri s
SET last_tahun_ajaran = (
    SELECT k.tahun_ajaran 
    FROM kalender_kuartal k
    ORDER BY ABS((COALESCE(s.tanggal_status, s.updated_at)::DATE - k.tgl_mulai)) ASC
    LIMIT 1
)
WHERE s.status != 'aktif' 
  AND s.last_tahun_ajaran IS NULL;

