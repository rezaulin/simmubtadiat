package models

import (
	"context"
	"testing"
	"time"
	_ "github.com/joho/godotenv"
)

// TestGuardRiwayatTidakKebalik mengunci guard insiden 2026-10-07:
// menutup riwayat terbuka yang tanggal_mulainya DI MASA DEPAN (sisa uji coba
// uji-coba naik/turun kelas) tidak boleh menghasilkan baris kebalik
// (tanggal_selesai < tanggal_mulai), dan riwayat baru tidak boleh dibuka
// sebelum hari tutup efektif.
//
// SELURUH operasi berjalan dalam SATU transaksi yang di-ROLLBACK — tidak
// menyisakan perubahan apa pun di database (aman dijalankan di DB live).
func TestGuardRiwayatTidakKebalik(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx)

	// Ambil santri & bagian nyata apa adanya (hanya jadi pembungkus test).
	var santriID, bagianID int
	if err := tx.QueryRow(ctx, `SELECT id FROM santri ORDER BY id LIMIT 1`).Scan(&santriID); err != nil {
		t.Skipf("tidak ada santri di DB test/live: %v", err)
	}
	if err := tx.QueryRow(ctx, `SELECT id FROM bagian ORDER BY id LIMIT 1`).Scan(&bagianID); err != nil {
		t.Skipf("tidak ada bagian: %v", err)
	}

	// Rekaan riwayat terbuka dengan tanggal MULAI di masa depan — persis
	// kondisi yang dulu menghasilkan baris kebalik.
	masaDepan := time.Now().AddDate(0, 0, 30).Format("2006-01-02")
	if _, err := tx.Exec(ctx,
		`INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai, tanggal_selesai)
		 VALUES ($1, $2, $3::date, NULL)`, santriID, bagianID, masaDepan); err != nil {
		t.Fatalf("insert riwayat rekaan: %v", err)
	}

	// Tutup dengan acuan HARI INI (padahal mulai masih 30 hari ke depan).
	hariIni := time.Now()
	tutupEff, err := tutupRiwayatTerbuka(ctx, tx, santriID, hariIni)
	if err != nil {
		t.Fatalf("tutupRiwayatTerbuka: %v", err)
	}

	// 1) Tidak ada satu pun baris santri ini yang kebalik.
	var kebalik int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM riwayat_bagian
		  WHERE santri_id = $1 AND tanggal_selesai IS NOT NULL
		    AND tanggal_selesai < tanggal_mulai`, santriID).Scan(&kebalik); err != nil {
		t.Fatalf("cek kebalik: %v", err)
	}
	if kebalik != 0 {
		t.Errorf("baris kebalik (selesai < mulai): %d — guard GAGAL", kebalik)
	}

	// 2) Hari tutup efektif TIDAK boleh lebih awal dari tanggal_mulai terbuka.
	if tutupEff.Format("2006-01-02") != masaDepan {
		t.Errorf("tutup efektif = %s, harus %s (tanggal_mulai riwayat terbuka, bukan hari ini)",
			tutupEff.Format("2006-01-02"), masaDepan)
	}

	// 3) Riwayat baru tidak pernah dibuka sebelum hari tutup efektif.
	buka := tanggalPalingAwal(hariIni, tutupEff)
	if buka.Before(tutupEff) {
		t.Errorf("riwayat baru dibuka %s sebelum tutup %s — tumpang tindih",
			buka.Format("2006-01-02"), tutupEff.Format("2006-01-02"))
	}
	// Acuan normal (setelah tutup) dipertahankan apa adanya.
	normal := tutupEff.AddDate(0, 0, 1)
	if got := tanggalPalingAwal(normal, tutupEff); !got.Equal(normal) {
		t.Errorf("tanggalPalingAwal menggeser tanggal yang seharusnya aman: %s -> %s",
			normal.Format("2006-01-02"), got.Format("2006-01-02"))
	}

	// 4) parseTanggalAMAN tidak pernah panic/gagal ke tanggal nol.
	if parseTanggalAMAN("bukan-tanggal").IsZero() {
		t.Error("parseTanggalAMAN mengembalikan waktu nol")
	}

	// tx di-rollback oleh defer: tidak ada jejak di database.
}
