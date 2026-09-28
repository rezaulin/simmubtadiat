-- Tambah status 'dikeluarkan' (expelled) ke CHECK constraint santri.
-- Tambah kolom 'alasan' untuk mencatat alasan perubahan status (boyong/keluar/dikeluarkan).

-- 1. Update CHECK constraint: tambah 'dikeluarkan'
ALTER TABLE santri DROP CONSTRAINT IF EXISTS santri_status_check;
ALTER TABLE santri ADD CONSTRAINT santri_status_check
    CHECK (status IN ('aktif', 'cuti', 'pengabdian', 'lulus', 'boyong', 'keluar', 'dikeluarkan'));

-- 2. Tambah kolom alasan (wajib untuk boyong/keluar/dikeluarkan, opsional lainnya)
ALTER TABLE santri ADD COLUMN IF NOT EXISTS alasan TEXT;
