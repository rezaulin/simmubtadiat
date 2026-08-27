-- 050: Kolom nama_indo (nama mapel bahasa Indonesia) di mata_pelajaran.
-- Owner decision 2026-08: Riwayat Akademik & Penilaian tampilkan nama Indonesia
-- (diisi manual admin), sementara RAPORT CETAK tetap pakai nama Arab (nama_kitab).
-- Fallback jika nama_indo kosong: tampilkan Arab apa adanya (owner: "tampilkan arab").

ALTER TABLE mata_pelajaran
    ADD COLUMN IF NOT EXISTS nama_indo VARCHAR(255) DEFAULT '';
