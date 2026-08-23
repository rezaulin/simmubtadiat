package main

// Batch regen: GenerateNilaiKhos (smt 1 & 2) + GenerateAlBayan untuk semua
// santri aktif pada tahun ajaran tertentu, memakai logika terbaru.
import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mubtadiaat/app/config"
	"github.com/mubtadiaat/app/models"
)

const ta = "2026/2027"

func main() {
	ctx := context.Background()
	dsn := "postgres://" + os.Getenv("DB_USER") + ":" + os.Getenv("DB_PASS") +
		"@" + os.Getenv("DB_HOST") + ":" + os.Getenv("DB_PORT") + "/" + os.Getenv("DB_NAME") + "?sslmode=disable"
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		fmt.Println("koneksi gagal:", err)
		os.Exit(1)
	}
	config.DB = pool
	defer pool.Close()

	rows, err := pool.Query(ctx, `SELECT id, nama FROM santri WHERE status='aktif' ORDER BY nama`)
	if err != nil {
		fmt.Println("query santri gagal:", err)
		os.Exit(1)
	}
	defer rows.Close()

	var ids []int
	var names []string
	for rows.Next() {
		var id int
		var nama string
		if err := rows.Scan(&id, &nama); err != nil {
			fmt.Println("scan gagal:", err)
			os.Exit(1)
		}
		ids = append(ids, id)
		names = append(names, nama)
	}

	fmt.Printf("Santri aktif TA %s: %d orang\n", ta, len(ids))

	var khosOK, bayanOK, errs int
	for i, sid := range ids {
		if err := models.GenerateNilaiKhos(ctx, sid, 1, ta); err != nil {
			fmt.Printf("  [%d] %s: Khos Smt1 error: %v\n", i+1, names[i], err)
			errs++
			continue
		}
		if err := models.GenerateNilaiKhos(ctx, sid, 2, ta); err != nil {
			fmt.Printf("  [%d] %s: Khos Smt2 error: %v\n", i+1, names[i], err)
			errs++
			continue
		}
		khosOK++
		if err := models.GenerateAlBayan(ctx, sid, ta); err != nil {
			fmt.Printf("  [%d] %s: Bayan error: %v\n", i+1, names[i], err)
			errs++
		} else {
			bayanOK++
		}
	}

	fmt.Printf("\nSelesai. Khos OK=%d, Bayan OK=%d, error=%d\n", khosOK, bayanOK, errs)
}
