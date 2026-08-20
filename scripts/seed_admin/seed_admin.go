package main

import (
	"context"
	"fmt"
	"log"

	"github.com/mubtadiaat/app/config"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	config.ConnectDB()

	// Hash password "admin"
	hash, err := bcrypt.GenerateFromPassword([]byte("admin"), 12)
	if err != nil {
		log.Fatalf("Gagal hash password: %v", err)
	}

	// Insert into DB
	_, err = config.DB.Exec(context.Background(), `
		INSERT INTO users (username, password_hash, role, nama, is_password_changed, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (username) DO NOTHING
	`, "admin", string(hash), "pimpinan", "Administrator Utama", true, true)

	if err != nil {
		log.Fatalf("Gagal insert admin: %v", err)
	}

	fmt.Println("Berhasil membuat akun admin! Username: admin, Password: admin")
}
