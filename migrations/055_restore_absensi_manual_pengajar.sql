-- 055_restore_absensi_manual_pengajar.sql
-- Tabel absensi_manual_pengajar_bulanan HILANG dari database (hanya tersisa
-- salinan _backup). Padahal dipakai oleh:
--   - models.SaveKalenderSemesterHijri (backfill semester) → simpan kalender
--     semester Hijriyah dari UI ERROR 'relation does not exist'
--   - models.SaveAbsensiManualPengajarBulanan (input absensi pengajar bulanan)
-- Pulihkan tabel + 25 baris dari salinan backup (0 orphan, semua 2026/2027).

CREATE TABLE IF NOT EXISTS absensi_manual_pengajar_bulanan (
    id           SERIAL PRIMARY KEY,
    pengajar_id  INTEGER NOT NULL REFERENCES pengajar(id) ON DELETE CASCADE,
    tahun_hijri  INTEGER NOT NULL,
    bulan_hijri  INTEGER NOT NULL CHECK (bulan_hijri BETWEEN 1 AND 12),
    tahun_ajaran VARCHAR(9) NOT NULL,
    total_sakit  INTEGER NOT NULL DEFAULT 0,
    total_izin   INTEGER NOT NULL DEFAULT 0,
    total_alpha  INTEGER NOT NULL DEFAULT 0,
    total_hadir  INTEGER NOT NULL DEFAULT 0,
    semester     SMALLINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pengajar_id, tahun_hijri, bulan_hijri)
);

CREATE INDEX IF NOT EXISTS idx_absensi_manual_bln_pengajar
    ON absensi_manual_pengajar_bulanan(pengajar_id, tahun_ajaran);

INSERT INTO absensi_manual_pengajar_bulanan
    (pengajar_id, tahun_hijri, bulan_hijri, tahun_ajaran,
     total_sakit, total_izin, total_alpha, total_hadir, semester,
     created_at, updated_at)
SELECT b.pengajar_id, b.tahun_hijri, b.bulan_hijri, b.tahun_ajaran,
       b.total_sakit, b.total_izin, b.total_alpha, b.total_hadir, b.semester,
       b.created_at, b.updated_at
FROM absensi_manual_pengajar_bulanan_backup b
WHERE NOT EXISTS (
    SELECT 1 FROM absensi_manual_pengajar_bulanan a
    WHERE a.pengajar_id = b.pengajar_id
      AND a.tahun_hijri = b.tahun_hijri
      AND a.bulan_hijri = b.bulan_hijri
);

-- Catatan: tabel absensi manual milik TAHUN 2025/2026 ikut dipulihkan bila ada.
-- (Hasil query: baris backup semuanya 2026/2027.)

-- Tutup lubang kalender: TA 2025/2026 kuartal 4 berakhir 2026-01-12 sementara
-- TA 2026/2027 baru mulai 2026-04-05 → rentang 13 Jan–4 Apr 2026 tidak
-- dimiliki tahun ajaran mana pun. Hari-hari itu kini dimiliki TA lama
-- (tahun ajaran lama baru berikutnya baru dimulai 5 Apr), sehingga findTA(),
-- kunci semester absensi, dan fallback tahun ajaran selalu menemukan tahun.
UPDATE kalender_kuartal
   SET tgl_selesai = DATE '2026-04-04'
 WHERE tahun_ajaran = '2025/2026'
   AND kuartal = 4
   AND tgl_selesai < DATE '2026-04-04';

INSERT INTO schema_migrations (filename) VALUES ('055_restore_absensi_manual_pengajar.sql');
