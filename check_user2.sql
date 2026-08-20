SELECT pb.*, b.nama_bagian, k.nama as kelas, t.nama as tingkatan
FROM pengajar_bagian pb
JOIN bagian b ON pb.bagian_id = b.id
JOIN kelas k ON b.kelas_id = k.id
JOIN tingkatan t ON b.tingkatan_id = t.id
WHERE pb.pengajar_id = 141;
