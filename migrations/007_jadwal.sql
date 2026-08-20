-- 007_jadwal.sql
ALTER TABLE mata_pelajaran DROP CONSTRAINT mata_pelajaran_bagian_id_fkey;
ALTER TABLE mata_pelajaran DROP COLUMN bagian_id;
ALTER TABLE mata_pelajaran ADD COLUMN angkatan_id INT REFERENCES angkatan(id) ON DELETE CASCADE;
ALTER TABLE mata_pelajaran ADD COLUMN tingkatan_id INT REFERENCES tingkatan(id) ON DELETE CASCADE;
CREATE TABLE jadwal_pelajaran (
    id SERIAL PRIMARY KEY,
    bagian_id INT NOT NULL REFERENCES bagian(id) ON DELETE CASCADE,
    mapel_id INT NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
    pengajar_id INT REFERENCES pengajar(id) ON DELETE SET NULL,
    hari VARCHAR(20) NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
