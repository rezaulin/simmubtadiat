package main

import (
	"context"
	"fmt"
	"log"

	"github.com/mubtadiaat/app/config"
)

func main() {
	config.ConnectDB()

	// Add kategori to mata_pelajaran
	query := `ALTER TABLE mata_pelajaran ADD COLUMN IF NOT EXISTS kategori VARCHAR(50) DEFAULT 'umum';`
	
	_, err := config.DB.Exec(context.Background(), query)
	if err != nil {
		log.Fatalf("Failed to alter table: %v", err)
	}

	fmt.Println("Successfully added kategori to mata_pelajaran!")
}
