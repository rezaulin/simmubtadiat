-- 024_nomor_stambuk_urut.sql
-- Nomor Stambuk POSISI (otomatis) untuk raport.
-- Berbeda dari kolom `nomor_stambuk` (teks, ID registrasi manual yang dipakai
-- untuk pencarian/identitas). Kolom ini menyimpan nomor urut posisi per TINGKATAN
-- yang disusun ulang manual lewat tombol "Susun Ulang No. Stambuk".
--   Urutan: kelas (urutan) -> bagian (nama) -> nama santri.
--   Stabil sampai admin menyusun ulang (mis. saat kenaikan tingkatan).

ALTER TABLE santri ADD COLUMN IF NOT EXISTS nomor_stambuk_urut INT;
