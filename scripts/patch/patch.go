package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"
)

func main() {
	dbURL := "postgres://postgres:postgres@localhost:5432/mubtadiaat"
	conn, err := pgx.Connect(context.Background(), dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(context.Background())

	_, err = conn.Exec(context.Background(), `ALTER TABLE pengajar ADD COLUMN nik VARCHAR(255), ADD COLUMN foto_url TEXT;`)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error altering table: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Successfully added nik and foto_url to pengajar table")
}
