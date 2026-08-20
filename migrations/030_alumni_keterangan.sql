-- 030_alumni_keterangan.sql
-- Tambah field keterangan dan perbaiki field pengambilan ijazah di alumni.

-- Keterangan alumni (teks bebas: Menikah, Tidak Lulus UBK, Qodho Khidmah, dll)
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS keterangan TEXT;

-- Perbaiki status_ijazah: pastikan constraint mencakup semua opsi.
-- (sudah VARCHAR(50) DEFAULT 'belum', tapi tambah check kalau belum ada)
-- Tidak perlu ubah tipe, cukup pastikan frontend kirim: sudah/belum/tidak
