package main

import (
	"context"
	"fmt"
	
	"os"

	"github.com/mubtadiaat/app/config"
)

func main() {
	config.ConnectDB()

	ctx := context.Background()

	queries := []string{
		"ALTER TABLE mufatish_tingkatan DROP COLUMN user_id;",
		"ALTER TABLE mufatish_tingkatan ADD COLUMN pengajar_id INT REFERENCES pengajar(id) ON DELETE CASCADE;",
		"ALTER TABLE mustahiq_bagian DROP COLUMN user_id;",
		"ALTER TABLE mustahiq_bagian ADD COLUMN pengajar_id INT REFERENCES pengajar(id) ON DELETE CASCADE;",
	}

	for _, q := range queries {
		_, err := config.DB.Exec(ctx, q)
		if err != nil {
			fmt.Printf("Error running %s: %v\n", q, err)
		} else {
			fmt.Printf("Success: %s\n", q)
		}
	}
	
	os.Exit(0)
}
