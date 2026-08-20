-- 012_rename_role_admin.sql
-- Rename role 'pengecekan' to 'admin'.
-- The 'admin' role has full access, equivalent to 'pimpinan'.

-- SQLite does not support ALTER on CHECK constraints directly, and Postgres
-- needs the constraint dropped & recreated. This migration targets Postgres
-- (matching the existing migrations which use $1-style parameters / NOW()).

-- 1. Migrate existing rows first so they satisfy the new constraint.
UPDATE users SET role = 'admin' WHERE role = 'pengecekan';

-- 2. Recreate the CHECK constraint with 'admin' replacing 'pengecekan'.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('pimpinan', 'admin', 'mufatish', 'mustahiq', 'munawwib', 'wali_santri'));
