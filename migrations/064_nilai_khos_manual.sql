-- 064_nilai_khos_manual.sql
-- Penanda nilai raport (khos) yang DIEDIT MANUAL oleh guru.
--
-- Latar belakang (permintaan owner 2026-11-10): edit manual nilai raport
-- dihidupkan kembali. Tanpa penanda, setiap GenerateNilaiKhos akan menimpa
-- nilai manual pada Simpan berikutnya sehingga koreksi guru hilang.
--
-- Aturan: baris dengan is_manual = true TIDAK ditimpa GenerateNilaiKhos
-- (klausa WHERE pada ON CONFLICT ... DO UPDATE). Baris lain tetap otomatis
-- persis seperti sebelumnya. Rumus penilaian tidak berubah.
--
-- manual_by / manual_at = jejak audit siapa mengedit dan kapan.
-- Tombol "Hitung Ulang Raport" melepas penanda (is_manual = false) lalu
-- menghitung ulang dari rumus.
--
-- Idempoten: aman dijalankan berulang (IF NOT EXISTS).

ALTER TABLE nilai_khos
    ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS manual_by integer REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS manual_at timestamptz;

-- Sebagian besar baris is_manual = false -> partial index kecil & cepat.
CREATE INDEX IF NOT EXISTS idx_nilai_khos_is_manual
    ON nilai_khos (santri_id, tahun_ajaran, semester)
    WHERE is_manual;
