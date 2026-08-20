-- 011_refactor_kurikulum_kelas.sql
-- Rename angkatan -> kelas + tambah nama_kitab. Dibuat IDEMPOTEN (guard DO $$)
-- karena kolom nama_kitab juga ditambahkan di 010 dan urutan penerapan historis
-- bisa berbeda; aman untuk fresh deploy maupun database yang sebagian sudah migrasi.

-- 1. Rename table angkatan -> kelas (hanya bila belum).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'angkatan')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kelas') THEN
    ALTER TABLE angkatan RENAME TO kelas;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'angkatan_id_seq' AND relkind = 'S') THEN
    ALTER SEQUENCE angkatan_id_seq RENAME TO kelas_id_seq;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'angkatan_pkey') THEN
    ALTER TABLE kelas RENAME CONSTRAINT angkatan_pkey TO kelas_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'angkatan_nama_key') THEN
    ALTER TABLE kelas RENAME CONSTRAINT angkatan_nama_key TO kelas_nama_key;
  END IF;
END $$;

-- 2. Rename kolom & constraint di tabel anak (hanya bila masih nama lama).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bagian' AND column_name = 'angkatan_id') THEN
    ALTER TABLE bagian RENAME COLUMN angkatan_id TO kelas_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bagian_angkatan_id_fkey') THEN
    ALTER TABLE bagian RENAME CONSTRAINT bagian_angkatan_id_fkey TO bagian_kelas_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mata_pelajaran' AND column_name = 'angkatan_id') THEN
    ALTER TABLE mata_pelajaran RENAME COLUMN angkatan_id TO kelas_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mata_pelajaran_angkatan_id_fkey') THEN
    ALTER TABLE mata_pelajaran RENAME CONSTRAINT mata_pelajaran_angkatan_id_fkey TO mata_pelajaran_kelas_id_fkey;
  END IF;
END $$;

-- 3. Kolom nama_kitab (idempoten; mungkin sudah ditambah di 010).
ALTER TABLE mata_pelajaran ADD COLUMN IF NOT EXISTS nama_kitab VARCHAR(255);
