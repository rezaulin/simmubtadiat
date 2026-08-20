package models

import (
	"context"
	"errors"
	"fmt"

	"github.com/mubtadiaat/app/config"
)

// AssignStambukTingkatan memberikan Stambuk ke santri yang belum punya Stambuk.
// Stambuk = nomor urut dari semua siswa yang PERNAH belajar di tingkatan tersebut
// (termasuk alumni). Query via riwayat_bagian agar alumni yang bagian_id sudah
// NULL tetap terhitung. Stambuk bersifat permanen per tingkatan — sekali dapat,
// tidak berubah selama masih di tingkatan yang sama.
func AssignStambukTingkatan(ctx context.Context, santriIDs []int, tingkatanID int) error {
	if tingkatanID <= 0 || len(santriIDs) == 0 {
		return nil
	}

	// 1. Cari MAX Stambuk dari SEMUA santri yang pernah di tingkatan ini.
	//    Lewat riwayat_bagian agar alumni (bagian_id=NULL) tetap terhitung.
	var maxStambuk *int
	_ = config.DB.QueryRow(ctx,
		`SELECT MAX(
			NULLIF(regexp_replace(COALESCE(s.stambuk, ''), '\D', '', 'g'), '')::int
		 )
		 FROM santri s
		 WHERE EXISTS (
			SELECT 1 FROM riwayat_bagian rb
			JOIN bagian b ON rb.bagian_id = b.id
			WHERE rb.santri_id = s.id AND b.tingkatan_id = $1
		 )`, tingkatanID).Scan(&maxStambuk)

	nextStambuk := 1
	if maxStambuk != nil && *maxStambuk > 0 {
		nextStambuk = *maxStambuk + 1
	}

	// 2. Assign Stambuk ke santri yang belum punya Stambuk (baru masuk tingkatan ini).
	for _, sID := range santriIDs {
		var currentStambuk *string
		_ = config.DB.QueryRow(ctx,
			`SELECT stambuk FROM santri WHERE id = $1`, sID).Scan(&currentStambuk)

		if currentStambuk == nil || *currentStambuk == "" {
			_, err := config.DB.Exec(ctx,
				`UPDATE santri SET stambuk = $1 WHERE id = $2`,
				fmt.Sprintf("%d", nextStambuk), sID)
			if err != nil {
				return err
			}
			nextStambuk++
		}
	}
	return nil
}

// SusunUlangStambuk memberi Nomor Stambuk posisi (1..N) ke santri AKTIF pada satu
// KELAS (kombinasi tingkatan + kelas), diurutkan: bagian (nama) -> nama santri.
// Fungsi ini HANYA mengurus nomor_stambuk_urut (urutan di kelas), TIDAK menyentuh
// Stambuk. Stambuk dikelola terpisah oleh AssignStambukTingkatan.
func SusunUlangStambuk(ctx context.Context, tingkatanID, kelasID int) (int, error) {
	if tingkatanID <= 0 || kelasID <= 0 {
		return 0, errors.New("tingkatan_id dan kelas_id wajib")
	}

	tag, err := config.DB.Exec(ctx,
		`WITH ranked AS (
		   SELECT s.id,
		          (ROW_NUMBER() OVER (
		            ORDER BY b.nama_bagian ASC, s.nama ASC, s.id ASC
		          ))::int AS urut
		   FROM santri s
		   JOIN bagian b ON s.bagian_id = b.id
		   WHERE b.tingkatan_id = $1 AND b.kelas_id = $2 AND s.status = 'aktif'
		 )
		 UPDATE santri s
		 SET nomor_stambuk_urut = r.urut
		 FROM ranked r
		 WHERE s.id = r.id`, tingkatanID, kelasID)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}
