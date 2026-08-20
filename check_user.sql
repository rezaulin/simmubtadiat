SELECT u.id, u.username, u.role, u.pengajar_id FROM users u WHERE u.username = 'mafahim';

SELECT t.nama as tingkatan, k.nama as kelas, b.nama_bagian, b.id as bagian_id,
       mb.user_id as msub_user_id, mb.pengajar_id as msub_pengajar_id
FROM mustahiq_bagian mb
JOIN bagian b ON mb.bagian_id = b.id
JOIN kelas k ON b.kelas_id = k.id
JOIN tingkatan t ON b.tingkatan_id = t.id
WHERE mb.user_id = (SELECT id FROM users WHERE username = 'mafahim')
   OR mb.pengajar_id = (SELECT pengajar_id FROM users WHERE username = 'mafahim');

SELECT t.nama as tingkatan, k.nama as kelas, mk.user_id as mufatish_user_id
FROM mufatish_kelas mk
JOIN kelas k ON mk.kelas_id = k.id
JOIN tingkatan t ON mk.tingkatan_id = t.id
WHERE mk.user_id = (SELECT id FROM users WHERE username = 'mafahim');
