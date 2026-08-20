-- 021_agenda.sql
-- Fitur "Agenda Bebas": acara/agenda yang dibuat manual oleh admin dan tampil
-- di widget Kalender & Agenda pada dashboard untuk semua peran kecuali orang
-- tua (wali_santri). Sumber ini melengkapi kalender_kuartal & jadwal.
--
-- Ruang lingkup: acara all-day (tanpa jam). tgl_selesai opsional (NULL berarti
-- acara satu hari). Agenda berulang (recurring) sengaja belum didukung.

CREATE TABLE IF NOT EXISTS agenda (
    id          SERIAL PRIMARY KEY,
    judul       TEXT NOT NULL,
    deskripsi   TEXT,
    tgl_mulai   DATE NOT NULL,
    tgl_selesai DATE,                                  -- NULL = acara satu hari
    dibuat_oleh INT,                                   -- users.id pembuat (nullable, tanpa FK agar mandiri)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Jika tgl_selesai diisi, ia tidak boleh mendahului tgl_mulai.
    CONSTRAINT agenda_tgl_valid CHECK (tgl_selesai IS NULL OR tgl_selesai >= tgl_mulai)
);

-- Indeks bantu untuk kueri rentang tanggal (widget dashboard & agenda mendatang).
CREATE INDEX IF NOT EXISTS idx_agenda_tgl_mulai ON agenda(tgl_mulai);
CREATE INDEX IF NOT EXISTS idx_agenda_tgl_selesai ON agenda(tgl_selesai);
