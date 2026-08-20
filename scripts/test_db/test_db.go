package main

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbUrl := "postgres://mubtadiaat:mubtadiaat_secret@localhost:5432/mubtadiaat_db?sslmode=disable"
	db, err := pgxpool.New(context.Background(), dbUrl)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	query := `
		SELECT mb.id, mb.pengajar_id, p.nama as pengajar_nama, mb.bagian_id, b.nama_bagian as bagian_nama,
		       t.id as tingkatan_id, t.nama as tingkatan_nama, a.id as angkatan_id, a.nama as angkatan_nama
		FROM mustahiq_bagian mb
		JOIN pengajar p ON mb.pengajar_id = p.id
		JOIN bagian b ON mb.bagian_id = b.id
		JOIN angkatan a ON b.angkatan_id = a.id
		JOIN tingkatan t ON a.tingkatan_id = t.id
	`
	rows, err := db.Query(context.Background(), query)
	if err != nil {
		log.Fatalf("Query err: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id, pengajarID, bagianID, tingkatanID, angkatanID int
		var pengajarNama, bagianNama, tingkatanNama, angkatanNama string
		if err := rows.Scan(&id, &pengajarID, &pengajarNama, &bagianID, &bagianNama, &tingkatanID, &tingkatanNama, &angkatanID, &angkatanNama); err != nil {
			log.Fatalf("Scan err: %v", err)
		}
		fmt.Println("Row:", id, pengajarNama)
	}
	fmt.Println("Success")
}
