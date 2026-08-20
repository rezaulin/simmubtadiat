package models

import (
	"context"
	"testing"
)

// TestMigrasi020PengabdianKhidmah adalah smoke test untuk migrasi
// 020_pengabdian_khidmah.sql. Test ini memverifikasi:
//   1. CHECK constraint santri.status menerima nilai 'pengabdian'
//      (Requirement 1.1).
//   2. Kolom khidmah_tempat, khidmah_mulai, khidmah_selesai menerima NULL
//      untuk santri yang belum pernah menempuh pengabdian (Requirement 1.5).
//
// Feature: santri-pengabdian-khidmah
func TestMigrasi020PengabdianKhidmah(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	// Bersihkan tabel santri (dan dependennya) sebelum test.
	db.Exec(ctx, "TRUNCATE santri CASCADE")

	// 1. Insert santri dengan status 'pengabdian' harus sukses.
	//    Kolom khidmah sengaja tidak diisi (menerima NULL / default NULL).
	var santriID int
	err := db.QueryRow(ctx, `
		INSERT INTO santri (nik, stambuk, nama, status)
		VALUES ('9990001', 'STB-PENG-001', 'Santri Pengabdian', 'pengabdian')
		RETURNING id`).Scan(&santriID)
	if err != nil {
		t.Fatalf("Insert santri status 'pengabdian' gagal (CHECK constraint belum menerima 'pengabdian'?): %v", err)
	}

	// Verifikasi status tersimpan sebagai 'pengabdian'.
	var status string
	if err := db.QueryRow(ctx, `SELECT status FROM santri WHERE id = $1`, santriID).Scan(&status); err != nil {
		t.Fatalf("Membaca status santri gagal: %v", err)
	}
	if status != "pengabdian" {
		t.Errorf("Status santri diharapkan 'pengabdian', diperoleh %q", status)
	}

	// 2. Kolom khidmah harus menerima NULL dan terbaca sebagai NULL.
	var khidmahTempat *string
	var khidmahMulai, khidmahSelesai *string // pindai DATE sebagai *string agar NULL terdeteksi
	err = db.QueryRow(ctx, `
		SELECT khidmah_tempat,
		       khidmah_mulai::text,
		       khidmah_selesai::text
		FROM santri WHERE id = $1`, santriID).
		Scan(&khidmahTempat, &khidmahMulai, &khidmahSelesai)
	if err != nil {
		t.Fatalf("Membaca kolom khidmah gagal (kolom belum ada?): %v", err)
	}
	if khidmahTempat != nil {
		t.Errorf("khidmah_tempat diharapkan NULL, diperoleh %q", *khidmahTempat)
	}
	if khidmahMulai != nil {
		t.Errorf("khidmah_mulai diharapkan NULL, diperoleh %q", *khidmahMulai)
	}
	if khidmahSelesai != nil {
		t.Errorf("khidmah_selesai diharapkan NULL, diperoleh %q", *khidmahSelesai)
	}

	// Bersihkan data test.
	db.Exec(ctx, `DELETE FROM santri WHERE id = $1`, santriID)
}
