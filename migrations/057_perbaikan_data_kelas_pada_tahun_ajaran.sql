-- 057_perbaikan_data_kelas_pada_tahun_ajaran.sql
-- Latar: penempatan kelas sebelumnya dihitung dari santri.bagian_id (posisi
-- KINI), bukan dari riwayat_bagian pada tahun ajaran yang bersangkutan. Akibat
-- kenaikan kelas, data tahun lama ikut "menyesuaikan" kelas baru:
--   * nilai_kompetensi  : kategori divalidasi dengan kelas baru → kategori yang
--                         sebetulnya tidak berlaku untuk kelasnya di tahun itu
--                         sempat tersimpan.
--   * setoran_juz_amma  : rentang surat dibuat dari target kelas baru → baris
--                         surat di BAWAH target tahun itu ikut tercipta.
-- Kode sudah diperbaiki lewat models.KelasPadaTA (commit ini); migrasi ini
-- membersihkan data yang tersimpan salah.
--
-- Kelas pada tahun ajaran diturunkan dengan aturan yang sama persis dengan
-- models.KelasPadaTA: baris riwayat_bagian yang BERIRISAN dengan rentang
-- kalender_kuartal TA itu, dipilih yang tanggal_selesai-nya paling akhir
-- (NULL = masih aktif duluan), lalu tanggal_mulai paling akhir.
-- Santri tanpa riwayat yang beririsan TIDAK disentuh (fallback = kelas kini,
-- sama dengan perilaku kode).

WITH ta AS (
    SELECT tahun_ajaran, MIN(tgl_mulai) AS mulai, MAX(tgl_selesai) AS selesai
    FROM kalender_kuartal
    GROUP BY tahun_ajaran
),
penempatan AS (
    SELECT DISTINCT ON (r.santri_id, t.tahun_ajaran)
           r.santri_id, t.tahun_ajaran, r.bagian_id
    FROM riwayat_bagian r
    JOIN ta t ON r.tanggal_mulai <= t.selesai
             AND (r.tanggal_selesai IS NULL OR r.tanggal_selesai >= t.mulai)
    ORDER BY r.santri_id, t.tahun_ajaran, r.tanggal_selesai DESC, r.tanggal_mulai DESC
),
kelas AS (
    SELECT p.santri_id, p.tahun_ajaran,
           COALESCE(LOWER(t.nama), '') AS tingkatan,
           COALESCE(k.nama, '')        AS kelas
    FROM penempatan p
    JOIN bagian b         ON b.id = p.bagian_id
    JOIN kelas k          ON k.id = b.kelas_id
    LEFT JOIN tingkatan t ON t.id = b.tingkatan_id
),
-- Kategori kompetensi yang berlaku per kelas (sama dengan
-- models.KompetensiEligible): 3 tsn = ubq+kitab+praktik, 1 aly = praktik,
-- 2 aly = ubq, 3 aly = kitab+praktik, 6 ibt = semua.
kategori_sah AS (
    SELECT DISTINCT santri_id, tahun_ajaran, kat
    FROM kelas,
         LATERAL (VALUES ('ubq'), ('praktik'), ('kitab')) AS v(kat)
    WHERE (tingkatan = 'ibtidaiyah' AND kelas = '6')
       OR (kat = 'ubq'     AND ((tingkatan = 'tsanawiyah' AND kelas = '3') OR (tingkatan = 'aliyah' AND kelas = '2')))
       OR (kat = 'praktik' AND ((tingkatan = 'tsanawiyah' AND kelas = '3') OR (tingkatan = 'aliyah' AND kelas IN ('1','3'))))
       OR (kat = 'kitab'   AND ((tingkatan = 'tsanawiyah' AND kelas = '3') OR (tingkatan = 'aliyah' AND kelas = '3')))
),
-- Target Juz Amma (surat terendah, rentang 114..target) per kelas — sama
-- dengan models.SuratTargetJuz. NULL = kelas tanpa setoran Juz Amma.
target AS (
    SELECT santri_id, tahun_ajaran,
           CASE
             WHEN tingkatan = 'ibtidaiyah' AND kelas = '4' THEN 108
             WHEN tingkatan = 'ibtidaiyah' AND kelas = '5' THEN 104
             WHEN tingkatan = 'ibtidaiyah' AND kelas = '6' THEN 99
             WHEN tingkatan = 'tsanawiyah' AND kelas = '1' THEN 97
             WHEN tingkatan = 'tsanawiyah' AND kelas = '2' THEN 93
             WHEN tingkatan = 'tsanawiyah' AND kelas = '3' THEN 87
             WHEN tingkatan = 'aliyah'      AND kelas = '1' THEN 83
             WHEN tingkatan = 'aliyah'      AND kelas = '2' THEN 80
             WHEN tingkatan = 'aliyah'      AND kelas = '3' THEN 78
           END AS batas
    FROM kelas
),
-- ── A. nilai_kompetensi: buang kategori yang tidak berlaku untuk kelasnya ──
hapus_kompetensi AS (
    DELETE FROM nilai_kompetensi n
    WHERE EXISTS (
        SELECT 1 FROM kelas k
        WHERE k.santri_id = n.santri_id AND k.tahun_ajaran = n.tahun_ajaran
    )
    AND NOT EXISTS (
        SELECT 1 FROM kategori_sah ks
        WHERE ks.santri_id = n.santri_id AND ks.tahun_ajaran = n.tahun_ajaran
          AND ks.kat = n.kategori
    )
    RETURNING n.santri_id, n.tahun_ajaran, n.kategori
),
-- ── B. setoran_juz_amma: buang baris surat di bawah target tahun itu ───────
hapus_setoran AS (
    DELETE FROM setoran_juz_amma s
    USING target t
    WHERE t.santri_id = s.santri_id AND t.tahun_ajaran = s.tahun_ajaran
      AND t.batas IS NOT NULL
      AND s.surat_no < t.batas
    RETURNING s.santri_id, s.tahun_ajaran, s.surat_no
)
SELECT 'nilai_kompetensi dihapus' AS aksi, COUNT(*)::text AS jumlah FROM hapus_kompetensi
UNION ALL
SELECT 'setoran_juz_amma dihapus', COUNT(*)::text FROM hapus_setoran;

INSERT INTO schema_migrations (filename)
VALUES ('057_perbaikan_data_kelas_pada_tahun_ajaran.sql');
