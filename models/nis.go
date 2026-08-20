package models

import (
	"context"
	"fmt"

	"github.com/mubtadiaat/app/config"
)

// NisSantriItem satu baris santri untuk pengelolaan NIS massal.
type NisSantriItem struct {
	SantriID     int     `json:"santri_id"`
	Nama         string  `json:"nama"`
	NomorStambuk string  `json:"nomor_stambuk"`
	NIS          *string `json:"nis"`
	BagianID     int     `json:"bagian_id"`
	NamaBagian   string  `json:"nama_bagian"`
}

// NisKelasResponse berisi daftar santri di 1 kelas (lintas bagian) + NIS terakhir
// di tingkatan tersebut untuk auto-detect angka mulai.
type NisKelasResponse struct {
	Santri   []NisSantriItem `json:"santri"`
	MaxNIS   int             `json:"max_nis"`   // NIS tertinggi (angka) di tingkatan
	NextNIS  int             `json:"next_nis"`  // MaxNIS + 1
}

// GetNisKelas mengembalikan santri aktif di kelas (tingkatan+kelas), urut
// nama_bagian ASC, lalu nama ASC. Juga menghitung NIS tertinggi di seluruh
// santri yang pernah/masih ada di tingkatan tersebut (dari bagian_id saat ini
// atau dari riwayat_bagian) — hanya NIS berupa angka murni yang dihitung.
func GetNisKelas(ctx context.Context, tingkatanID, kelasID int) (*NisKelasResponse, error) {
	// 1. Ambil santri aktif di kelas ini (semua bagian).
	rows, err := config.DB.Query(ctx, `
		SELECT s.id, s.nama, s.nomor_stambuk, s.nis, s.bagian_id, b.nama_bagian
		FROM santri s
		JOIN bagian b ON s.bagian_id = b.id
		WHERE b.tingkatan_id = $1 AND b.kelas_id = $2 AND s.status = 'aktif'
		ORDER BY b.nama_bagian ASC, s.nama ASC`,
		tingkatanID, kelasID)
	if err != nil {
		return nil, fmt.Errorf("gagal ambil santri: %v", err)
	}
	defer rows.Close()

	items := []NisSantriItem{}
	for rows.Next() {
		var it NisSantriItem
		if err := rows.Scan(&it.SantriID, &it.Nama, &it.NomorStambuk, &it.NIS,
			&it.BagianID, &it.NamaBagian); err != nil {
			return nil, err
		}
		items = append(items, it)
	}

	// 2. Hitung MAX NIS (angka murni) di tingkatan ini.
	// Cakupan: santri yang saat ini di bagian tingkatan ini ATAU pernah menempati
	// bagian tingkatan ini (riwayat_bagian). Jadi alumni pun ikut dihitung.
	var maxNIS int
	err = config.DB.QueryRow(ctx, `
		SELECT COALESCE(MAX(nis::INTEGER), 0)
		FROM santri
		WHERE nis ~ '^[0-9]+$'
		  AND (
		    bagian_id IN (SELECT id FROM bagian WHERE tingkatan_id = $1)
		    OR id IN (
		      SELECT DISTINCT rb.santri_id FROM riwayat_bagian rb
		      JOIN bagian b ON rb.bagian_id = b.id
		      WHERE b.tingkatan_id = $1
		    )
		  )`, tingkatanID).Scan(&maxNIS)
	if err != nil {
		return nil, fmt.Errorf("gagal hitung MAX NIS: %v", err)
	}

	return &NisKelasResponse{
		Santri:  items,
		MaxNIS:  maxNIS,
		NextNIS: maxNIS + 1,
	}, nil
}

// NisUpdateItem satu baris payload untuk bulk update NIS.
type NisUpdateItem struct {
	SantriID int    `json:"santri_id"`
	NIS      string `json:"nis"` // kosong = clear NIS
}

// BulkUpdateNIS menyimpan array {santri_id, nis} dalam satu transaksi.
// NIS kosong akan di-set NULL (santri tidak punya NIS di tingkatan ini).
func BulkUpdateNIS(ctx context.Context, items []NisUpdateItem) error {
	if len(items) == 0 {
		return nil
	}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, it := range items {
		if it.NIS == "" {
			_, err = tx.Exec(ctx, `UPDATE santri SET nis = NULL WHERE id = $1`, it.SantriID)
		} else {
			_, err = tx.Exec(ctx, `UPDATE santri SET nis = $1 WHERE id = $2`, it.NIS, it.SantriID)
		}
		if err != nil {
			return fmt.Errorf("gagal update NIS santri %d: %v", it.SantriID, err)
		}
	}

	return tx.Commit(ctx)
}
