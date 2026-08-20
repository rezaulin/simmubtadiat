package models

import (
	"context"
	"testing"
)

func TestPindahBagian(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	// Clear tables
	db.Exec(ctx, "TRUNCATE tingkatan, kelas, bagian, santri, pengajar_bagian, riwayat_bagian CASCADE")

	// Create Tingkatan & Kelas
	var tingkatanID, kelasID int
	db.QueryRow(ctx, `INSERT INTO tingkatan (nama, urutan, is_active) VALUES ('Test Tingkatan', 1, true) RETURNING id`).Scan(&tingkatanID)
	db.QueryRow(ctx, `INSERT INTO kelas (nama, tahun_masuk) VALUES ('Test Kelas Pindah', '2023') RETURNING id`).Scan(&kelasID)

	// Create Bagian Asal & Bagian Baru
	var bagianAsalID, bagianBaruID int
	db.QueryRow(ctx, `INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1, $2, 'Awal') RETURNING id`, kelasID, tingkatanID).Scan(&bagianAsalID)
	db.QueryRow(ctx, `INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1, $2, 'Baru') RETURNING id`, kelasID, tingkatanID).Scan(&bagianBaruID)

	// Create Santri
	var santriID int
	db.QueryRow(ctx, `INSERT INTO santri (nik, stambuk, nama, bagian_id, status) VALUES ('123', 'STB123', 'Test Santri', $1, 'aktif') RETURNING id`, bagianAsalID).Scan(&santriID)

	// Insert initial riwayat
	db.Exec(ctx, `INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai) VALUES ($1, $2, CURRENT_DATE)`, santriID, bagianAsalID)

	// Pindah Bagian
	err := PindahBagian(ctx, bagianAsalID, []int{santriID}, bagianBaruID, false)
	if err != nil {
		t.Fatalf("PindahBagian failed: %v", err)
	}

	// Verify Santri is updated
	var currentBagian int
	db.QueryRow(ctx, `SELECT bagian_id FROM santri WHERE id = $1`, santriID).Scan(&currentBagian)
	if currentBagian != bagianBaruID {
		t.Errorf("Expected bagian_id %d, got %d", bagianBaruID, currentBagian)
	}

	// Verify Riwayat Asal is closed
	var isClosed bool
	db.QueryRow(ctx, `SELECT (tanggal_selesai IS NOT NULL) FROM riwayat_bagian WHERE santri_id = $1 AND bagian_id = $2`, santriID, bagianAsalID).Scan(&isClosed)
	if !isClosed {
		t.Errorf("Expected initial riwayat_bagian to be closed")
	}

	// Verify New Riwayat exists
	var count int
	db.QueryRow(ctx, `SELECT COUNT(*) FROM riwayat_bagian WHERE santri_id = $1 AND bagian_id = $2 AND tanggal_selesai IS NULL`, santriID, bagianBaruID).Scan(&count)
	if count != 1 {
		t.Errorf("Expected new active riwayat_bagian to be created")
	}
}

func TestProsesKeluarSantri(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	// Clear tables
	db.Exec(ctx, "TRUNCATE tingkatan, kelas, bagian, santri, riwayat_bagian, proses_keluar, alumni CASCADE")

	var tingkatanID, kelasID, bagianID, santriID int
	err := db.QueryRow(ctx, `INSERT INTO tingkatan (nama, urutan) VALUES ('Test Tingkatan Keluar', 1) RETURNING id`).Scan(&tingkatanID)
	if err != nil { t.Fatalf("Tingkatan: %v", err) }
	err = db.QueryRow(ctx, `INSERT INTO kelas (nama, tahun_masuk) VALUES ('Test Kelas Keluar', '2023') RETURNING id`).Scan(&kelasID)
	if err != nil { t.Fatalf("Kelas: %v", err) }
	err = db.QueryRow(ctx, `INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1, $2, 'Test') RETURNING id`, kelasID, tingkatanID).Scan(&bagianID)
	if err != nil { t.Fatalf("Bagian: %v", err) }
	err = db.QueryRow(ctx, `INSERT INTO santri (nik, stambuk, nama, bagian_id, status) VALUES ('321', 'STB321', 'Test Santri 2', $1, 'aktif') RETURNING id`, bagianID).Scan(&santriID)
	if err != nil { t.Fatalf("Santri: %v", err) }

	db.Exec(ctx, `INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai) VALUES ($1, $2, CURRENT_DATE)`, santriID, bagianID)

	input := ProsesKeluarInput{
		SantriID:      santriID,
		StatusAkhir:   "lulus",
		TanggalKeluar: "2024-05-01",
		Alasan:        "Lulus Ujian",
	}

	err = ProsesKeluarSantri(ctx, input)
	if err != nil {
		t.Fatalf("ProsesKeluarSantri failed: %v", err)
	}

	// Verify Santri status updated
	var status string
	db.QueryRow(ctx, `SELECT status FROM santri WHERE id = $1`, santriID).Scan(&status)
	if status != "lulus" {
		t.Errorf("Expected status 'lulus', got %s", status)
	}

	// Verify Proses Keluar recorded
	var count int
	db.QueryRow(ctx, `SELECT COUNT(*) FROM proses_keluar WHERE santri_id = $1`, santriID).Scan(&count)
	if count != 1 {
		t.Errorf("Expected proses_keluar to be recorded")
	}

	// Verify Alumni recorded
	db.QueryRow(ctx, `SELECT COUNT(*) FROM alumni WHERE santri_id = $1`, santriID).Scan(&count)
	if count != 1 {
		t.Errorf("Expected alumni to be recorded")
	}
}
