-- 019_add_admin_role.sql
-- Menambahkan 'admin' sebagai role yang sah dan TERPISAH (bukan mengganti
-- 'pengecekan'). 'admin' berperan sebagai administrator penuh, setara 'pimpinan'.
--
-- Catatan: migrasi 012_rename_role_admin.sql (yang me-rename pengecekan -> admin)
-- dianggap usang / tidak dipakai. Migrasi ini yang menjadi acuan final untuk
-- daftar role pada constraint users_role_check.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('pimpinan', 'admin', 'mufatish', 'mustahiq', 'munawwib', 'pengecekan', 'wali_santri'));
