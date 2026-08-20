
-- 1. Isi last_tahun_ajaran berdasarkan tanggal_status dengan mencocokkan di tabel kalender_kuartal
UPDATE santri s
SET last_tahun_ajaran = (
    SELECT k.tahun_ajaran 
    FROM kalender_kuartal k
    WHERE s.tanggal_status::DATE BETWEEN k.tgl_mulai AND k.tgl_selesai 
    LIMIT 1
)
WHERE s.status != 'aktif' 
  AND s.last_tahun_ajaran IS NULL 
  AND s.tanggal_status IS NOT NULL;

-- 2. Jika tanggal_status NULL, coba pakai tanggal updated_at terakhir sebelum status berubah
UPDATE santri s
SET last_tahun_ajaran = (
    SELECT k.tahun_ajaran 
    FROM kalender_kuartal k
    WHERE s.updated_at::DATE BETWEEN k.tgl_mulai AND k.tgl_selesai 
    LIMIT 1
)
WHERE s.status != 'aktif' 
  AND s.last_tahun_ajaran IS NULL;

-- 3. Backfill last_bagian_id darurat dari nilai_am jika masih kosong
UPDATE santri s
SET last_bagian_id = (
    SELECT n.bagian_id 
    FROM nilai_am n
    WHERE n.santri_id = s.id 
    ORDER BY n.created_at DESC LIMIT 1
)
WHERE s.status != 'aktif' 
  AND s.last_bagian_id IS NULL;

