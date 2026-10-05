-- 056_kalender_tahun_ajaran_lengkap.sql
-- Tujuan: supaya SETIAP bulan Hijriyah dan SETIAP tanggal Masehi selalu
-- dimiliki satu tahun ajaran, sehingga riwayat absensi + penilaian bisa
-- ditelusuri bertahun-tahun tanpa bulan yang "yatim" (tahun ajaran kosong).
--
-- Dua lubang ditutup di sini:
--   A. TA 2025/2026 tidak punya kalender semester Hijri sama sekali →
--      bulan sebelum Syawwal 1447 tidak ditaungi tahun ajaran mana pun.
--   B. Celah 13 Jan - 24 Mar 2027 (TA 2026/2027 berakhir 12 Jan 2027,
--      TA 2027/2028 baru mulai 25 Mar 2027) — pola yang sama dengan celah
--      13 Jan - 4 Apr 2026 yang sudah ditutup migrasi 055.
--
-- Konversi Masehi → Hijri memakai kalender Umm al-Qura, SAMA PERSIS dengan
-- yang dipakai frontend (Intl "en-US-u-ca-islamic-umalqura"). Metode ini sudah
-- divalidasi: ke-8 tanggal yang sudah tersimpan di kalender_semester_hijri
-- direproduksi 8/8 cocok.

-- ---------------------------------------------------------------------------
-- A. TA 2025/2026 — diturunkan dari kalender_kuartal yang sudah ada
--    (Q1+Q2 = semester 1, Q3+Q4 = semester 2, sama seperti tahun lain):
--      sem 1 : 2025-04-05 -> 2025-09-11  =  1446-10-07 -> 1447-03-19
--      sem 2 : 2025-09-12 -> 2026-04-04  =  1447-03-20 -> 1447-10-16
--    sem 2 berakhir 1447-10-16 = sehari sebelum TA 2026/2027 mulai
--    (1447-10-17) → bersambung, tanpa tumpang tindih.
-- ---------------------------------------------------------------------------
INSERT INTO kalender_semester_hijri
    (tahun_ajaran, semester,
     mulai_tahun_hijri, mulai_bulan_hijri, mulai_tanggal,
     selesai_tahun_hijri, selesai_bulan_hijri, selesai_tanggal,
     masehi_mulai, masehi_selesai)
VALUES
    ('2025/2026', 1, 1446, 10,  7, 1447,  3, 19, DATE '2025-04-05', DATE '2025-09-11'),
    ('2025/2026', 2, 1447,  3, 20, 1447, 10, 16, DATE '2025-09-12', DATE '2026-04-04')
ON CONFLICT (tahun_ajaran, semester) DO NOTHING;

-- ---------------------------------------------------------------------------
-- B1. Sisi Masehi: tutup celah 13 Jan - 24 Mar 2027 (kuintal 4 TA 2026/2027
--     diperpanjang sampai sehari sebelum TA 2027/2028 mulai).
--     Ini pola yang sama dengan migrasi 055 (findTA() harus selalu menemukan
--     tahun ajaran untuk SEMUA tanggal).
-- ---------------------------------------------------------------------------
UPDATE kalender_kuartal
   SET tgl_selesai = DATE '2027-03-24'
 WHERE tahun_ajaran = '2026/2027'
   AND kuartal = 4
   AND tgl_selesai < DATE '2027-03-24';

-- ---------------------------------------------------------------------------
-- B2. Sisi Hijri: perpanjang semester 2 TA 2026/2027 sampai 1448-10-16
--     (sehari sebelum TA 2027/2028 mulai 1448-10-17).
--     Akibatnya Ramadhan 1448 (1448-09) yang sebelumnya tidak ditaungi tahun
--     ajaran mana pun kini menjadi bagian TA 2026/2027 — konsisten dengan
--     sisi Masehi (Ramadhan 1448 jatuh di Feb-Mar 2027, masih dalam
--     kuintal 4 TA 2026/2027 hasil B1).
-- ---------------------------------------------------------------------------
UPDATE kalender_semester_hijri
   SET selesai_tahun_hijri  = 1448,
       selesai_bulan_hijri  = 10,
       selesai_tanggal      = 16,
       masehi_selesai       = DATE '2027-03-24'
 WHERE tahun_ajaran = '2026/2027'
   AND semester = 2
   AND selesai_tahun_hijri * 360 + selesai_bulan_hijri * 30 + selesai_tanggal
       < 1448 * 360 + 10 * 30 + 16;

INSERT INTO schema_migrations (filename)
VALUES ('056_kalender_tahun_ajaran_lengkap.sql');
