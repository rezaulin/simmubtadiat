sudo docker exec simmubtadiat-db-1 psql -U mubtadiaat -d mubtadiaat_db -c "SELECT u.username, ur.role FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE u.username = 'mafahim';"
