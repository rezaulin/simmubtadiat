-- Fixture riwayat TA 2025/2026 utk demo & E2E fitur "riwayat penilaian
-- tambahan tetap tampil saat naik kelas" (spek owner 2026-10-02).
-- AMAN dijalankan ulang (ON CONFLICT DO NOTHING / NOT EXISTS).
-- Santri: 101 Khoiroh — kini 2 Aliyah A (TA 2026/2027), sebelumnya 1 Aliyah A.
-- BALIK KEMBALI (hapus fixture):
--   DELETE FROM setoran_juz_amma WHERE tahun_ajaran='2025/2026';
--   DELETE FROM nilai_kompetensi WHERE tahun_ajaran='2025/2026';
--   DELETE FROM riwayat_bagian WHERE santri_id=101 AND bagian_id=14;
--   DELETE FROM kalender_kuartal WHERE tahun_ajaran='2025/2026';

-- 1. Kalender kuartal TA 2025/2026 (cermin 2026/2027 digeser 1 tahun;
--    selesai 2026-01-12 < mulai 2026/2027 2026-04-05 → tidak tumpang tindih)
INSERT INTO kalender_kuartal (kuartal, tahun_ajaran, tgl_mulai, tgl_selesai) VALUES
  (1, '2025/2026', DATE '2025-04-05', DATE '2025-06-23'),
  (2, '2025/2026', DATE '2025-06-24', DATE '2025-09-11'),
  (3, '2025/2026', DATE '2025-09-12', DATE '2025-11-11'),
  (4, '2025/2026', DATE '2025-11-12', DATE '2026-01-12')
ON CONFLICT (kuartal, tahun_ajaran) DO NOTHING;

-- 2. Riwayat bagian: santri 101 di 1 Aliyah A (bagian 14) selama TA itu —
--    sumber riwayat-akademik supaya tahun 2025/2026 muncul di tab riwayat
INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai, tanggal_selesai)
SELECT 101, 14, DATE '2025-04-07', DATE '2026-06-20'
WHERE NOT EXISTS (
  SELECT 1 FROM riwayat_bagian
  WHERE santri_id = 101 AND bagian_id = 14 AND tanggal_mulai = DATE '2025-04-07'
);

-- 3. Setoran Juz Amma TA 2025/2026: An-Nas s/d 'Abasa (114..80) semua
--    setor, evaluasi lulus, status selesai
INSERT INTO setoran_juz_amma (santri_id, surat_no, setor, evaluasi, status, tahun_ajaran)
SELECT 101, n, true, 'lulus', 'selesai', '2025/2026'
FROM generate_series(114, 80, -1) AS n
ON CONFLICT (santri_id, surat_no, tahun_ajaran) DO NOTHING;

-- 4. Nilai Kompetensi TA 2025/2026: Ujian Baca Al-Qur'an lulus
INSERT INTO nilai_kompetensi (santri_id, kategori, hasil, tahun_ajaran)
VALUES (101, 'ubq', 'lulus', '2025/2026')
ON CONFLICT (santri_id, kategori, tahun_ajaran) DO NOTHING;
