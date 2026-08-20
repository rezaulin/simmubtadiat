
SELECT s.nama, s.status, s.last_bagian_id, b.nama_bagian, b.tingkatan, b.kelas
FROM santri s
LEFT JOIN bagian b ON b.id = s.last_bagian_id
WHERE s.status != 'aktif' AND s.last_bagian_id IS NOT NULL;

