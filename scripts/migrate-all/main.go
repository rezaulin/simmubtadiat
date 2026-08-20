// Command migrate-all menyiapkan skema database saat container start.
//
// Strategi "anti-ribet":
//   - DB KOSONG (fresh)  -> jalankan db/baseline.sql (skema final lengkap dalam
//     satu berkas), lalu tandai SEMUA migrasi lama sebagai sudah diterapkan.
//   - DB BERISI          -> jalankan migrasi yang belum diterapkan satu per satu
//     (dilacak di schema_migrations), idempoten.
// Migrasi baru (mis. 027+) di masa depan tetap berjalan normal pada kedua kasus.
//
// Setelah skema siap, opsional membuat akun pimpinan awal bila env
// SEED_ADMIN_PASSWORD diisi DAN belum ada user pimpinan/admin.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mubtadiaat/app/config"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	config.ConnectDB()
	ctx := context.Background()

	migDir := "migrations"
	if len(os.Args) > 1 && os.Args[1] != "" {
		migDir = os.Args[1]
	}
	baselinePath := "db/baseline.sql"
	manifestPath := "db/baseline_manifest.txt"

	if _, err := config.DB.Exec(ctx,
		`CREATE TABLE IF NOT EXISTS public.schema_migrations (
			filename    TEXT PRIMARY KEY,
			applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		fail("Gagal membuat schema_migrations", err)
	}

	files := listMigrations(migDir)

	// Jalur cepat untuk deploy fresh: terapkan baseline (skema final lengkap),
	// lalu tandai HANYA migrasi yang tercakup manifest sebagai sudah diterapkan.
	// Migrasi di luar manifest (mis. 027+ yang ditambahkan setelah baseline dibuat)
	// TIDAK ditandai, sehingga tetap dijalankan pada loop bertahap di bawah.
	if isFreshDB(ctx) && fileExists(baselinePath) {
		sqlBytes, err := os.ReadFile(baselinePath)
		if err != nil {
			fail("Gagal membaca baseline", err)
		}
		if _, err := config.DB.Exec(ctx, string(sqlBytes)); err != nil {
			fail("Gagal menjalankan baseline.sql", err)
		}

		covered := loadManifest(manifestPath, files)
		marked := 0
		for name := range covered {
			if _, err := config.DB.Exec(ctx,
				`INSERT INTO public.schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`, name); err != nil {
				fail("Gagal menandai migrasi", err)
			}
			marked++
		}
		fmt.Printf("Baseline diterapkan (skema lengkap) + %d migrasi ditandai selesai.\n", marked)
	}

	// Jalur migrasi bertahap. Untuk fresh+baseline hanya menjalankan migrasi yang
	// belum tercatat (di luar manifest). Untuk DB berisi menjalankan semua yang belum diterapkan.
	applied := 0
	for _, name := range files {
		var exists bool
		if err := config.DB.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM public.schema_migrations WHERE filename = $1)`, name).Scan(&exists); err != nil {
			fail("Gagal cek status migrasi", err)
		}
		if exists {
			continue
		}
		sqlBytes, err := os.ReadFile(filepath.Join(migDir, name))
		if err != nil {
			fail("Gagal membaca "+name, err)
		}
		if _, err := config.DB.Exec(ctx, string(sqlBytes)); err != nil {
			fail("Gagal menjalankan migrasi "+name, err)
		}
		if _, err := config.DB.Exec(ctx,
			`INSERT INTO public.schema_migrations (filename) VALUES ($1)`, name); err != nil {
			fail("Gagal mencatat migrasi", err)
		}
		fmt.Println("Migrasi diterapkan:", name)
		applied++
	}
	fmt.Printf("Selesai. %d migrasi baru diterapkan (total berkas: %d).\n", applied, len(files))

	seedAdminIfNeeded(ctx)
}

func fail(msg string, err error) {
	fmt.Printf("%s: %v\n", msg, err)
	os.Exit(1)
}

func fileExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && !info.IsDir()
}

// isFreshDB true bila tabel inti (users) belum ada.
func isFreshDB(ctx context.Context) bool {
	var reg *string
	if err := config.DB.QueryRow(ctx, `SELECT to_regclass('public.users')::text`).Scan(&reg); err != nil {
		return false
	}
	return reg == nil
}

// loadManifest membaca daftar migrasi yang tercakup baseline.
// Jika manifest tidak ada, fallback: anggap SEMUA berkas migrasi saat ini tercakup
// (perilaku lama) agar tetap aman untuk baseline tanpa manifest.
func loadManifest(path string, allFiles []string) map[string]struct{} {
	set := make(map[string]struct{})
	data, err := os.ReadFile(path)
	if err != nil {
		for _, f := range allFiles {
			set[f] = struct{}{}
		}
		return set
	}
	for _, line := range strings.Split(string(data), "\n") {
		name := strings.TrimSpace(line)
		if name != "" && strings.HasSuffix(name, ".sql") {
			set[name] = struct{}{}
		}
	}
	return set
}

func listMigrations(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		fail("Gagal membaca folder migrasi", err)
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)
	return files
}

// seedAdminIfNeeded membuat akun pimpinan awal jika belum ada user pimpinan/admin
// DAN env SEED_ADMIN_PASSWORD terisi. Username dari SEED_ADMIN_USERNAME (default "admin").
func seedAdminIfNeeded(ctx context.Context) {
	pass := os.Getenv("SEED_ADMIN_PASSWORD")
	if strings.TrimSpace(pass) == "" {
		return
	}
	username := os.Getenv("SEED_ADMIN_USERNAME")
	if strings.TrimSpace(username) == "" {
		username = "admin"
	}

	var cnt int
	if err := config.DB.QueryRow(ctx,
		`SELECT COUNT(1) FROM users WHERE role IN ('pimpinan','admin')`).Scan(&cnt); err != nil {
		fmt.Println("Gagal cek user admin:", err)
		return
	}
	if cnt > 0 {
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		fmt.Println("Gagal hash password admin:", err)
		return
	}
	if _, err := config.DB.Exec(ctx,
		`INSERT INTO users (username, password_hash, role, nama, is_password_changed, is_active)
		 VALUES ($1, $2, 'pimpinan', 'Administrator', true, true)`,
		username, string(hash)); err != nil {
		fmt.Println("Gagal membuat akun admin:", err)
		return
	}
	fmt.Printf("Akun pimpinan awal dibuat: username=%s\n", username)
}
