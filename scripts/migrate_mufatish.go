package main

import (
	"context"
	"log"

	"github.com/mubtadiaat/app/config"
)

func main() {
	config.ConnectDB()
	ctx := context.Background()

	queries := []string{
		`CREATE TABLE IF NOT EXISTS mufatish_bagian (
			id SERIAL PRIMARY KEY,
			pengajar_id INT REFERENCES pengajar(id) ON DELETE CASCADE,
			bagian_id INT REFERENCES bagian(id) ON DELETE CASCADE,
			user_id INT REFERENCES users(id) ON DELETE SET NULL,
			tahun_ajaran VARCHAR(20),
			created_at TIMESTAMP DEFAULT NOW(),
			UNIQUE(bagian_id)
		);`,
		`INSERT INTO mufatish_bagian (pengajar_id, bagian_id, user_id, tahun_ajaran)
		 SELECT mt.pengajar_id, b.id, mt.user_id, mt.tahun_ajaran
		 FROM mufatish_tingkatan mt
		 JOIN bagian b ON mt.tingkatan_id = b.tingkatan_id
		 ON CONFLICT (bagian_id) DO UPDATE SET 
		   pengajar_id = EXCLUDED.pengajar_id,
		   user_id = EXCLUDED.user_id,
		   tahun_ajaran = EXCLUDED.tahun_ajaran,
		   created_at = NOW();`,
		`DROP TABLE IF EXISTS mufatish_tingkatan CASCADE;`,
	}

	for _, q := range queries {
		_, err := config.DB.Exec(ctx, q)
		if err != nil {
			log.Fatalf("Error executing query: %v\nQuery: %s", err, q)
		}
	}
	log.Println("Migration successful!")
}
