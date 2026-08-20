
-- Find the user ID for this user. Who is it?
-- The user said: 'saya sebagai mustahiq 2 aliyah dan mufattish 2 tsanawi'
SELECT id, username, role FROM users WHERE role ILIKE '%mustahiq%' OR role ILIKE '%mufatish%';

