-- 048: Constraint unique nilai_bayan per santri per tahun ajaran.
-- Mencegah duplikasi fisik (kasus santri pindah bagian menghasilkan 2 baris
-- nilai_bayan untuk TA yang sama). bagian_id tetap disimpan tapi tidak jadi
-- bagian dari uniqueness.
ALTER TABLE nilai_bayan
  DROP CONSTRAINT IF EXISTS nilai_bayan_santri_id_bagian_id_tahun_ajaran_key;

-- Bersihkan duplikat yang tersisa dulu (ambil yang paling baru di-update),
-- baru pasang constraint.
DELETE FROM nilai_bayan a
USING nilai_bayan b
WHERE a.santri_id = b.santri_id
  AND a.tahun_ajaran = b.tahun_ajaran
  AND a.id < b.id;

ALTER TABLE nilai_bayan
  ADD CONSTRAINT nilai_bayan_santri_tahun_unique UNIQUE (santri_id, tahun_ajaran);
