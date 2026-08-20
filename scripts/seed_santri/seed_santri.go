package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/mubtadiaat/app/config"
)

func main() {
	config.ConnectDB()
	ctx := context.Background()

	firstNames := []string{"Ahmad", "Muhammad", "Abdullah", "Umar", "Ali", "Hasan", "Husain", "Fatimah", "Aisyah", "Khadijah", "Zainab", "Ruqayyah", "Ummu", "Amirah", "Siti", "Nur", "Budi", "Joko"}
	lastNames := []string{"Syah", "Amin", "Hafiz", "Rahman", "Fauzi", "Putra", "Putri", "Sari", "Lestari", "Hidayat"}

	r := rand.New(rand.NewSource(time.Now().UnixNano()))

	fmt.Println("Memasukkan 100 data santri dummy...")
	for i := 1; i <= 100; i++ {
		nama := fmt.Sprintf("%s %s", firstNames[r.Intn(len(firstNames))], lastNames[r.Intn(len(lastNames))])
		nik := fmt.Sprintf("357%013d", r.Int63n(10000000000000))
		stambuk := fmt.Sprintf("STB-2026-%04d", 1000+i)
		
		_, err := config.DB.Exec(ctx, `
			INSERT INTO santri (nik, stambuk, nama, nama_wali, ttl_tempat, status)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, nik, stambuk, nama, "Wali "+nama, "Surabaya", "aktif")

		if err != nil {
			log.Printf("Gagal insert santri %d: %v", i, err)
		}
	}
	fmt.Println("Selesai! 100 Santri berhasil ditambahkan.")
}
