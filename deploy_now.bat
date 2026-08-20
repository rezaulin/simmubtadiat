scp sim.tar.gz ubuntu@43.156.230.10:/tmp/sim.tar.gz
ssh ubuntu@43.156.230.10 "cd /opt/simmubtadiat && sudo cp /tmp/sim.tar.gz . && sudo tar --no-same-owner --no-same-permissions -xzvf sim.tar.gz && sudo rm -f test_view.go test_view2.go && sudo docker compose up --build -d"
