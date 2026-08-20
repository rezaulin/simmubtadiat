package models

import (
	"context"
	"fmt"

	"github.com/mubtadiaat/app/config"
)

// StambukSantriItem satu baris santri untuk pengelolaan Stambuk massal.
type StambukSantriItem struct {
	SantriID     int     `json:"santri_id"`
	Nama         string  `json:"nama"`
	Stambuk      *string `json:"stambuk"`
	BagianID     int     `json:"bagian_id"`
	NamaBagian   string  `json:"nama_bagian"`
}

// StambukKelasResponse berisi daftar santri di 1 kelas (lintas bagian) + Stambuk terakhir
// di tingkatan tersebut untuk auto-detect angka mulai.
type StambukKelasResponse struct {
	Santri      []StambukSantriItem `json:"santri"`
	MaxStambuk  int                 `json:"max_stambuk"`  // Stambuk tertinggi (angka) di tingkatan
	NextStambuk int                 `json:"next_stambuk"` // MaxStambuk + 1
}

// GetStambukKelas mengembalikan santri aktif di kelas (tingkatan+kelas), urut
// nama_bagian ASC, lalu nama ASC. Juga menghitung Stambuk tertinggi di seluruh
// santri yang pernah/masih ada di tingkatan tersebut (dari bagian_id saat ini
// atau dari riwayat_bagian) — hanya Stambuk berupa angka murni yang dihitung.
func GetStambukKelas(ctx context.Context, tingkatanID, kelasID int) (*StambukKelasResponse, error) {
	// 1. Ambil santri aktif di kelas ini (semua bagian).
	rows, err := config.DB.Query(ctx, `
		SELECT s.id, s.nama, s.stambuk, s.bagian_id, b.nama_bagian
		FROM santri s
		JOIN bagian b ON s.bagian_id = b.id
		WHERE b.tingkatan_id = $1 AND b.kelas_id = $2 AND s.status = 'aktif'
		ORDER BY b.nama_bagian ASC, s.nama ASC`,
		tingkatanID, kelasID)
	if err != nil {
		return nil, fmt.Errorf("gagal ambil santri: %v", err)
	}
	defer rows.Close()

	items := []StambukSantriItem{}
	for rows.Next() {
		var it StambukSantriItem
		if err := rows.Scan(&it.SantriID, &it.Nama, &it.Stambuk,
			&it.BagianID, &it.NamaBagian); err != nil {
			return nil, err
		}
		items = append(items, it)
	}

	// 2. Hitung MAX Stambuk (angka murni) di tingkatan ini.
	// Cakupan: santri yang saat ini di bagian tingkatan ini ATAU pernah menempati
	// bagian tingkatan ini (riwayat_bagian). Jadi alumni pun ikut dihitung.
	var maxStambuk int
	err = config.DB.QueryRow(ctx, `
		SELECT COALESCE(MAX(stambuk::INTEGER), 0)
		FROM santri
		WHERE stambuk ~ '^[0-9]+$'
		  AND (
		    bagian_id IN (SELECT id FROM bagian WHERE tingkatan_id = $1)
		    OR id IN (
		      SELECT DISTINCT rb.santri_id FROM riwayat_bagian rb
		      JOIN bagian b ON rb.bagian_id = b.id
		      WHERE b.tingkatan_id = $1
		    )
		  )`, tingkatanID).Scan(&maxStambuk)
	if err != nil {
		return nil, fmt.Errorf("gagal hitung MAX Stambuk: %v", err)
	}

	return &StambukKelasResponse{
		Santri:      items,
		MaxStambuk:  maxStambuk,
		NextStambuk: maxStambuk + 1,
	}, nil
}

// StambukUpdateItem satu baris payload untuk bulk update Stambuk.
type StambukUpdateItem struct {
	SantriID int    `json:"santri_id"`
	Stambuk  string `json:"stambuk"` // kosong = clear Stambuk
}

// BulkUpdateStambuk menyimpan array {santri_id, stambuk} dalam satu transaksi.
// Stambuk kosong akan di-set NULL (santri tidak punya Stambuk di tingkatan ini).
func BulkUpdateStambuk(ctx context.Context, items []StambukUpdateItem) error {
	if len(items) == 0 {
		return nil
	}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, it := range items {
		if it.Stambuk == "" {
			_, err = tx.Exec(ctx, `UPDATE santri SET stambuk = NULL WHERE id = $1`, it.SantriID)
		} else {
			_, err = tx.Exec(ctx, `UPDATE santri SET stambuk = $1 WHERE id = $2`, it.Stambuk, it.SantriID)
		}
		if err != nil {
			return fmt.Errorf("gagal update Stambuk santri %d: %v", it.SantriID, err)
		}
	}

	return tx.Commit(ctx)
}
