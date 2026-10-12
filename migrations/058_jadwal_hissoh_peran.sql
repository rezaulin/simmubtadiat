-- 058_jadwal_hissoh_peran.sql — Jadwal v2 (permintaan client 2026-10-12)
--   * jam (jam_mulai/jam_selesai) diganti hissoh: 'ula' | 'tsaniyah'
--   * pengajar_id langsung diganti peran: 'mustahiq' | 'munawwib' — nama guru
--     di-resolve saat BACA dari penugasan terkini (ganti kuartal / ganti orang
--     di fitur penugasan → nama di jadwal ikut berganti otomatis).
--   * Jumat libur → baris jadwal Jumat dibuang.
--   * Unique index mencegah duplikat slot (klik dobel / submit ulang).

ALTER TABLE jadwal_pelajaran ADD COLUMN IF NOT EXISTS hissoh varchar(10) NOT NULL DEFAULT 'ula';
ALTER TABLE jadwal_pelajaran ADD COLUMN IF NOT EXISTS peran varchar(20) NOT NULL DEFAULT 'mustahiq';

-- Backfill peran SEBELUM kolom pengajar_id dibuang: pengajar yang tercatat
-- sebagai munawwib di bagian yang sama → 'munawwib'; selain itu 'mustahiq'.
UPDATE jadwal_pelajaran j
   SET peran = 'munawwib'
 WHERE j.pengajar_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM pengajar_bagian pb
                WHERE pb.bagian_id = j.bagian_id
                  AND pb.pengajar_id = j.pengajar_id
                  AND pb.peran = 'munawwib');

-- Jumat libur (keputusan client) — baris jadwal Jumat tidak berlaku lagi.
DELETE FROM jadwal_pelajaran WHERE hari = 'Jumat';

ALTER TABLE jadwal_pelajaran DROP COLUMN IF EXISTS jam_mulai;
ALTER TABLE jadwal_pelajaran DROP COLUMN IF EXISTS jam_selesai;
ALTER TABLE jadwal_pelajaran DROP COLUMN IF EXISTS pengajar_id;

CREATE UNIQUE INDEX IF NOT EXISTS jadwal_slot_unik
  ON jadwal_pelajaran (bagian_id, hari, hissoh, mapel_id, peran);
