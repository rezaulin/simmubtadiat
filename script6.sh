sudo docker exec simmubtadiat-db-1 psql -U mubtadiaat -d mubtadiaat_db -c "SELECT id, kelas_id, tingkatan_id, nama_bagian FROM bagian WHERE tingkatan_id = 4 AND kelas_id = 3;"
