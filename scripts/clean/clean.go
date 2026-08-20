package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"
)

func main() {
	dbURL := "postgres://mubtadiaat:mubtadiaat_secret@localhost:5432/mubtadiaat_db"
	conn, err := pgx.Connect(context.Background(), dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(context.Background())

	_, err = conn.Exec(context.Background(), `
		DELETE FROM riwayat_bagian WHERE bagian_id IN (SELECT id FROM bagian WHERE tingkatan_id IN (49, 50) OR angkatan_id IN (SELECT id FROM angkatan WHERE nama LIKE '%Test%'));
		DELETE FROM santri WHERE bagian_id IN (SELECT id FROM bagian WHERE tingkatan_id IN (49, 50) OR angkatan_id IN (SELECT id FROM angkatan WHERE nama LIKE '%Test%'));
		DELETE FROM bagian WHERE tingkatan_id IN (49, 50) OR angkatan_id IN (SELECT id FROM angkatan WHERE nama LIKE '%Test%'); 
		DELETE FROM tingkatan WHERE nama LIKE '%Test%' OR id IN (49, 50); 
		DELETE FROM angkatan WHERE nama LIKE '%Test%';
	`)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error cleaning data: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Successfully cleaned test data")
}
