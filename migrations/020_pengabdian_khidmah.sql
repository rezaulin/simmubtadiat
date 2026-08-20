-- 020_pengabdian_khidmah.sql
-- Menambah tahap "Pengabdian" (Khidmah) pada siklus hidup santri.

-- 1. Perluas CHECK constraint santri.status agar menerima 'pengabdian'.
--    Constraint asli dibuat inline di 002_master.sql tanpa nama eksplisit,
--    sehingga PostgreSQL memberinya nama otomatis santri_status_check.
ALTER TABLE santri DROP CONSTRAINT IF EXISTS santri_status_check;
ALTER TABLE santri ADD CONSTRAINT santri_status_check
    CHECK (status IN ('aktif', 'cuti', 'pengabdian', 'lulus', 'boyong', 'keluar'));

-- 2. Kolom khidmah pada santri (semua nullable → boleh kosong untuk santri
--    yang belum pernah berkhidmah).
ALTER TABLE santri ADD COLUMN IF NOT EXISTS khidmah_tempat   TEXT;
ALTER TABLE santri ADD COLUMN IF NOT EXISTS khidmah_mulai    DATE;
ALTER TABLE santri ADD COLUMN IF NOT EXISTS khidmah_selesai  DATE;

-- 3. Pastikan kolom alumni.khidmah tersedia (dibuat lewat skrip fix_alumni
--    pada sebagian lingkungan; idempoten di sini agar migrasi mandiri).
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS khidmah VARCHAR(255);

-- 4. Indeks bantu untuk daftar & filter santri pengabdian.
CREATE INDEX IF NOT EXISTS idx_santri_status ON santri(status);
