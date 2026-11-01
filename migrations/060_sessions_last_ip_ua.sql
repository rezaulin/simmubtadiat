-- 060_sessions_last_ip_ua.sql
-- Tambah kolom last_ip & last_ua ke tabel sessions.
--
-- Latar belakang: middleware/auth.go menjalankan
--   UPDATE sessions SET last_ip=$1, last_ua=$2 WHERE id=$3
-- untuk mencatat IP & User-Agent terakhir pemakai sesi (audit keamanan:
-- mendeteksi akun yang dipakai bersama atau dibajak). Kolom ini belum ada
-- di schema awal sehingga setiap UPDATE gagal dengan error
--   column "last_ip" of relation "sessions" does not exist
-- dan memenuhi log PostgreSQL.
--
-- Idempoten: aman dijalankan berulang (IF NOT EXISTS).
-- last_ip VARCHAR(45) -> cukup untuk IPv4 dan IPv6 (maks 45 karakter).
-- last_ua TEXT        -> User-Agent bisa panjang, TEXT tanpa batas.

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45),
    ADD COLUMN IF NOT EXISTS last_ua TEXT;
