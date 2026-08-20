package main

import (
	"context"
	"fmt"
	"os"

	"github.com/mubtadiaat/app/config"
)

func main() {
	config.ConnectDB()

	// File migrasi dapat diberikan sebagai argumen pertama; default ke contoh lama.
	sqlFile := "migrations/007_jadwal.sql"
	if len(os.Args) > 1 && os.Args[1] != "" {
		sqlFile = os.Args[1]
	}
	query, err := os.ReadFile(sqlFile)
	if err != nil {
		fmt.Println("Error reading file:", err)
		return
	}

	_, err = config.DB.Exec(context.Background(), string(query))
	if err != nil {
		fmt.Println("Error executing migration:", err)
		return
	}

	fmt.Println("Migration executed successfully!")
}
