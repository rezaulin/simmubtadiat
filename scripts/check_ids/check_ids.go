package main

import (
	"context"
	"fmt"
	"github.com/mubtadiaat/app/config"
)

func main() {
	config.ConnectDB()
	rows, _ := config.DB.Query(context.Background(), "SELECT id, nama FROM tingkatan")
	for rows.Next() {
		var id int
		var nama string
		rows.Scan(&id, &nama)
		fmt.Printf("Tingkatan: %d -> %s\n", id, nama)
	}

	rows2, _ := config.DB.Query(context.Background(), "SELECT id, nama FROM angkatan")
	for rows2.Next() {
		var id int
		var nama string
		rows2.Scan(&id, &nama)
		fmt.Printf("Angkatan: %d -> %s\n", id, nama)
	}
}
