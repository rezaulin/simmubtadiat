package main

import (
	"context"
	"log"
	"github.com/mubtadiaat/app/config"
)

func main() {
	config.ConnectDB()
	ctx := context.Background()
	_, err := config.DB.Exec(ctx, `
		ALTER TABLE alumni 
		RENAME COLUMN status_khidmah TO khidmah;
	`)
	if err != nil {
		log.Println("Rename error (might already be renamed):", err)
	}
	
	_, err = config.DB.Exec(ctx, `
		ALTER TABLE alumni
		ADD COLUMN IF NOT EXISTS no_ijazah VARCHAR(100);
	`)
	if err != nil {
		log.Println("Add column error:", err)
	} else {
		log.Println("Alumni table fixed")
	}
}
