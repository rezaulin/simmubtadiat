-- 025_catatan_santri.sql
-- Catatan Pelanggaran & Prestasi santri (deskriptif, tanpa poin).
-- Melekat ke santri_id sehingga tetap tampil setelah menjadi alumni.
--   jenis: 'pelanggaran' | 'prestasi'
--   kategori: teks bebas (opsional), deskripsi: wajib.
--   pencatat: user_id / pengajar_id yang menambahkan.

CREATE TABLE IF NOT EXISTS catatan_santri (
    id           SERIAL PRIMARY KEY,
    santri_id    INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
    jenis        VARCHAR(12) NOT NULL CHECK (jenis IN ('pelanggaran', 'prestasi')),
    tanggal      DATE NOT NULL,
    kategori     VARCHAR(120),
    deskripsi    TEXT NOT NULL,
    tahun_ajaran VARCHAR(9),
    pengajar_id  INT REFERENCES pengajar(id) ON DELETE SET NULL,
    user_id      INT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catatan_santri_santri ON catatan_santri(santri_id, tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_catatan_santri_jenis ON catatan_santri(jenis);
