scp check_user.sql ubuntu@43.156.230.10:/tmp/check_user.sql
ssh ubuntu@43.156.230.10 "cd /opt/simmubtadiat && sudo docker compose exec -T db psql -U mubtadiaat -d mubtadiaat_db -f /tmp/check_user.sql"
