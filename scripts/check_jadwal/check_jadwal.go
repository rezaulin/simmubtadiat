package main

import (
	"context"
	"fmt"
	"github.com/mubtadiaat/app/config"
)

func main() {
	config.ConnectDB()
	
	fmt.Println("Jadwal for pengajar=5:")
	rows, _ := config.DB.Query(context.Background(), "SELECT bagian_id, hari, jam, mapel_id FROM jadwal_pelajaran WHERE pengajar_id = 5")
	for rows.Next() {
		var b, j, m int
		var h string
		rows.Scan(&b, &h, &j, &m)
		fmt.Printf("bagian=%d hari=%s jam=%d mapel=%d\n", b, h, j, m)
	}
	rows.Close()
}
