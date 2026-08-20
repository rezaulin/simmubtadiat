package main

import (
	"context"
	"fmt"
	"log"

	"github.com/mubtadiaat/app/config"
)

func main() {
	config.ConnectDB()
	
	rows, err := config.DB.Query(context.Background(), "SELECT column_name FROM information_schema.columns WHERE table_name = 'mustahiq_bagian'")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("mustahiq_bagian columns:")
	for rows.Next() {
		var col string
		rows.Scan(&col)
		fmt.Println("- " + col)
	}
}
