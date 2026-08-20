-- 001_init.sql
-- Core System Tables: Users, Sessions, Settings

CREATE TABLE users (
    id                  SERIAL PRIMARY KEY,
    username            VARCHAR(255) UNIQUE NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    role                VARCHAR(50) NOT NULL CHECK (role IN ('pimpinan', 'mufatish', 'mustahiq', 'munawwib', 'pengecekan', 'wali_santri')),
    nama                VARCHAR(255) NOT NULL,
    pengajar_id         INT, -- Nullable, foreign key will be added after pengajar table is created
    is_password_changed BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id          UUID PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expired_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
    id          SERIAL PRIMARY KEY,
    key         VARCHAR(255) UNIQUE NOT NULL,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rapot_settings (
    id                      SERIAL PRIMARY KEY,
    header_baris_1          VARCHAR(255),
    header_baris_2          VARCHAR(255),
    header_baris_3          VARCHAR(255),
    nama_kepala             VARCHAR(255),
    nip_kepala              VARCHAR(255),
    logo_url                VARCHAR(255),
    urutan_kolom_identitas  JSONB,
    updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dynamic_columns (
    id              SERIAL PRIMARY KEY,
    target_table    VARCHAR(50) NOT NULL CHECK (target_table IN ('santri', 'alumni', 'pengajar', 'dewan_harian')),
    column_key      VARCHAR(255) NOT NULL,
    column_label    VARCHAR(255) NOT NULL,
    column_type     VARCHAR(50) NOT NULL CHECK (column_type IN ('text', 'number', 'date', 'select', 'textarea')),
    select_options  JSONB,
    is_required     BOOLEAN NOT NULL DEFAULT FALSE,
    urutan          INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (target_table, column_key)
);
