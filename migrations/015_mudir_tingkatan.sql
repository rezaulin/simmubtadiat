-- 015_mudir_tingkatan.sql
-- Nama Mudir (مدير المعهد) per tingkatan untuk tanda tangan raport semester 2.
-- Satu mudir per tingkatan. Nama disimpan sebagai teks (bukan relasi ke pengajar),
-- karena jabatan mudir terpisah dari data pengajar. Boleh diisi huruf Latin maupun Arab.

CREATE TABLE IF NOT EXISTS mudir_tingkatan (
    id            SERIAL PRIMARY KEY,
    tingkatan_id  INT NOT NULL REFERENCES tingkatan(id) ON DELETE CASCADE,
    nama_mudir    VARCHAR(255) NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tingkatan_id)
);

CREATE INDEX IF NOT EXISTS idx_mudir_tingkatan_tingkatan ON mudir_tingkatan(tingkatan_id);
