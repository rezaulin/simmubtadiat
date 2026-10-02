-- 054_penilaian_tambahan.sql
-- Tabel BARU untuk menu Penilaian (tab-tab baru): Di Bawah Rata², Setoran Juz
-- Amma, Nilai Kompetensi. Tidak menyentuh tabel nilai lama sama sekali.

-- Tab "Di Bawah Rata²": hanya menyimpan status takziran;
-- nilai (jumlah + rata²) SELALU dihitung live dari nilai_kuartal.
CREATE TABLE IF NOT EXISTS penilaian_takziran (
  id              SERIAL PRIMARY KEY,
  santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  kuartal         INT NOT NULL CHECK (kuartal BETWEEN 1 AND 4),
  tahun_ajaran    VARCHAR(9) NOT NULL,
  konsekuensi     TEXT,                        -- teks bebas (keputusan owner)
  jenis_takziran  TEXT,                        -- teks bebas (keputusan owner)
  dalam_masa      BOOLEAN NOT NULL DEFAULT false,
  selesai         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (santri_id, kuartal, tahun_ajaran)
);

-- Tab "Setoran Juz Amma": satu baris per santri × surat (78..114).
CREATE TABLE IF NOT EXISTS setoran_juz_amma (
  id              SERIAL PRIMARY KEY,
  santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  surat_no        INT NOT NULL CHECK (surat_no BETWEEN 78 AND 114),
  setor           BOOLEAN NOT NULL DEFAULT false,   -- ceklis nama surat
  evaluasi        VARCHAR(20) CHECK (evaluasi IN ('lulus','her','tidak_lulus')),
  status          VARCHAR(10) NOT NULL DEFAULT 'belum'
                    CHECK (status IN ('selesai','belum')),
  tahun_ajaran    VARCHAR(9) NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (santri_id, surat_no, tahun_ajaran)
);

-- Tab "Nilai Kompetensi": ujian baca Al-Qur'an / praktik / baca kitab.
CREATE TABLE IF NOT EXISTS nilai_kompetensi (
  id              SERIAL PRIMARY KEY,
  santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  kategori        VARCHAR(10) NOT NULL CHECK (kategori IN ('ubq','praktik','kitab')),
  hasil           VARCHAR(12) CHECK (hasil IN ('lulus','her','tidak_lulus')),
  tahun_ajaran    VARCHAR(9) NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (santri_id, kategori, tahun_ajaran)
);

CREATE INDEX IF NOT EXISTS idx_takziran_ta      ON penilaian_takziran(tahun_ajaran, kuartal);
CREATE INDEX IF NOT EXISTS idx_setoran_ta       ON setoran_juz_amma(tahun_ajaran, santri_id);
CREATE INDEX IF NOT EXISTS idx_kompetensi_ta    ON nilai_kompetensi(tahun_ajaran, kategori);
