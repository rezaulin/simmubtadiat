UPDATE mustahiq_bagian mb SET user_id = (
  SELECT u.id FROM users u 
  JOIN user_roles ur ON ur.user_id = u.id
  WHERE u.pengajar_id = mb.pengajar_id 
    AND ur.role = 'mustahiq'
    AND u.username NOT LIKE '%__deleted_%' 
  LIMIT 1
) WHERE EXISTS (
  SELECT 1 FROM users u2 
  JOIN user_roles ur2 ON ur2.user_id = u2.id
  WHERE u2.pengajar_id = mb.pengajar_id 
    AND ur2.role = 'mustahiq'
    AND u2.username NOT LIKE '%__deleted_%'
);

UPDATE mufatish_kelas mk SET user_id = (
  SELECT u.id FROM users u 
  JOIN user_roles ur ON ur.user_id = u.id
  WHERE u.pengajar_id = mk.pengajar_id 
    AND ur.role = 'mufatish'
    AND u.username NOT LIKE '%__deleted_%' 
  LIMIT 1
) WHERE EXISTS (
  SELECT 1 FROM users u2 
  JOIN user_roles ur2 ON ur2.user_id = u2.id
  WHERE u2.pengajar_id = mk.pengajar_id 
    AND ur2.role = 'mufatish'
    AND u2.username NOT LIKE '%__deleted_%'
);
