package models

import (
	"context"
	"errors"

	"github.com/mubtadiaat/app/config"
)

// PindahBagian memindahkan santri (satu atau banyak) ke bagian baru dengan menutup riwayat lama.
// Digunakan untuk naik kelas (batch) maupun mutasi (individu).
func PindahBagian(ctx context.Context, bagianAsalID int, santriIDs []int, bagianBaruID int, pindahMustahiq bool, roles []string, userID int) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Cek otorisasi mustahiq
	isGlobal := false
	isMustahiq := false
	for _, r := range roles {
		if r == "pimpinan" || r == "admin" {
			isGlobal = true
		}
		if r == "mustahiq" {
			isMustahiq = true
		}
	}

	if isMustahiq && !isGlobal && bagianAsalID > 0 {
		var count int
		err := tx.QueryRow(ctx, `
			SELECT COUNT(1) 
			FROM bagian b_asal
			WHERE b_asal.id = $1 AND EXISTS (
				SELECT 1 FROM bagian b_mus
				JOIN mustahiq_bagian mb ON mb.bagian_id = b_mus.id
				WHERE (mb.user_id = $2 OR mb.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $2)) AND b_mus.tingkatan_id = b_asal.tingkatan_id AND b_mus.kelas_id = b_asal.kelas_id
			)`, bagianAsalID, userID).Scan(&count)
		if err != nil || count == 0 {
			return errors.New("mustahiq tidak berhak memindahkan santri dari bagian ini")
		}
	}

	for _, sID := range santriIDs {
		// 1. Update riwayat_bagian lama yang belum selesai
		_, err := tx.Exec(ctx,
			`UPDATE riwayat_bagian 
			 SET tanggal_selesai = CURRENT_DATE 
			 WHERE santri_id = $1 AND tanggal_selesai IS NULL`, sID)
		if err != nil {
			return err
		}

		// 2. Buat riwayat_bagian baru
		_, err = tx.Exec(ctx,
			`INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai) 
			 VALUES ($1, $2, CURRENT_DATE)`, sID, bagianBaruID)
		if err != nil {
			return err
		}

		// 3. Update master data santri
		_, err = tx.Exec(ctx,
			`UPDATE santri 
			 SET bagian_id = $1, status = 'aktif' 
			 WHERE id = $2`, bagianBaruID, sID)
		if err != nil {
			return err
		}
	}

	if pindahMustahiq && bagianAsalID != 0 {
		_, err := tx.Exec(ctx,
			`UPDATE pengajar_bagian
			 SET bagian_id = $1
			 WHERE bagian_id = $2 AND peran = 'mustahiq'`, bagianBaruID, bagianAsalID)
		if err != nil {
			return err
		}
	}

	// 4. Cek apakah pindah ANTAR TINGKATAN (sebelum commit)
	var tingkatanAsalID int
	if bagianAsalID > 0 {
		_ = tx.QueryRow(ctx, `SELECT tingkatan_id FROM bagian WHERE id = $1`, bagianAsalID).Scan(&tingkatanAsalID)
	}

	var tingkatanID, kelasID int
	err = tx.QueryRow(ctx, `SELECT tingkatan_id, kelas_id FROM bagian WHERE id = $1`, bagianBaruID).Scan(&tingkatanID, &kelasID)
	if err == nil && tingkatanID > 0 && kelasID > 0 {
		if tingkatanAsalID != tingkatanID {
			// Matikan fitur nis auto: jangan override NIS ketika pindah tingkatan
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// 5. Eksekusi Post-Commit (Susun ulang urut stambuk)
	if tingkatanID > 0 && kelasID > 0 {
		// Susun ulang nomor stambuk urut (urutan kelas, bukan NIS).
		_, _ = SusunUlangStambuk(ctx, tingkatanID, kelasID)
	}

	return nil
}

// UbahStatusStatusSantri mengubah status santri (cuti, dll)
// Jika status bukan 'aktif', riwayat kelas berjalan akan ditutup.
func UbahStatusStatusSantri(ctx context.Context, santriID int, status string, tanggalStatus string, roles []string, userID int) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Cek otorisasi mustahiq
	isGlobal := false
	isMustahiq := false
	for _, r := range roles {
		if r == "pimpinan" || r == "admin" {
			isGlobal = true
		}
		if r == "mustahiq" {
			isMustahiq = true
		}
	}

	if isMustahiq && !isGlobal {
		var count int
		err := tx.QueryRow(ctx, `
			SELECT COUNT(1) 
			FROM santri s 
			JOIN bagian b_santri ON s.bagian_id = b_santri.id
			WHERE s.id = $1 AND EXISTS (
				SELECT 1 FROM bagian b_mus
				JOIN mustahiq_bagian mb ON mb.bagian_id = b_mus.id
				WHERE (mb.user_id = $2 OR mb.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $2)) AND b_mus.tingkatan_id = b_santri.tingkatan_id AND b_mus.kelas_id = b_santri.kelas_id
			)
		`, santriID, userID).Scan(&count)
		if err != nil || count == 0 {
			return errors.New("mustahiq tidak berhak mengubah status santri ini")
		}
	}

	// Jika tanggal_status string kosong, set nil (untuk jaga-jaga kalau aktif kembali)
	var tanggal interface{}
	var ta string
	if tanggalStatus == "" {
		tanggal = nil
	} else {
		tanggal = tanggalStatus
		_ = tx.QueryRow(ctx, "SELECT tahun_ajaran FROM kalender_kuartal WHERE $1::DATE BETWEEN tgl_mulai AND tgl_selesai LIMIT 1", tanggalStatus).Scan(&ta)
		if ta == "" {
			_ = tx.QueryRow(ctx, "SELECT tahun_ajaran FROM kalender_kuartal ORDER BY tgl_selesai DESC LIMIT 1").Scan(&ta)
		}
	}

	_, err = tx.Exec(ctx, "UPDATE santri SET status = $1, tanggal_status = $2, last_tahun_ajaran = COALESCE(NULLIF($4, ''), last_tahun_ajaran) WHERE id = $3", status, tanggal, santriID, ta)
	if err != nil {
		return err
	}

	if status != "aktif" {
		_, err = tx.Exec(ctx,
			`UPDATE riwayat_bagian 
			 SET tanggal_selesai = CURRENT_DATE 
			 WHERE santri_id = $1 AND tanggal_selesai IS NULL`, santriID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
