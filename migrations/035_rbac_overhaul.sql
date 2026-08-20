-- 035_rbac_overhaul.sql
-- Overhaul RBAC system from 7 roles to 8 granular roles.

-- 1. Drop existing constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE pengajar DROP CONSTRAINT IF EXISTS pengajar_status_check;
ALTER TABLE pengajar_bagian DROP CONSTRAINT IF EXISTS pengajar_bagian_peran_check;

-- 2. Migrate existing data for roles that are renamed/removed
-- Rename 'munawwib' to 'muroqib' in users
UPDATE users SET role = 'muroqib' WHERE role = 'munawwib';
-- Anyone remaining with 'pengecekan' (which shouldn't happen if 019_add_admin_role was applied correctly, but just in case)
UPDATE users SET role = 'muroqib' WHERE role = 'pengecekan';

-- Rename 'munawwib' in pengajar status
UPDATE pengajar SET status = 'muroqib' WHERE status = 'munawwib';

-- Rename 'munawwib' in pengajar_bagian
UPDATE pengajar_bagian SET peran = 'muroqib' WHERE peran = 'munawwib';

-- 3. Add new constraints with the updated 8 roles
ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('pimpinan', 'admin', 'mufatish', 'mustahiq', 'muroqib', 'tim_rapot', 'keamanan', 'wali_santri'));

ALTER TABLE pengajar
    ADD CONSTRAINT pengajar_status_check
    CHECK (status IN ('mustahiq', 'muroqib'));

ALTER TABLE pengajar_bagian
    ADD CONSTRAINT pengajar_bagian_peran_check
    CHECK (peran IN ('mustahiq', 'muroqib'));
