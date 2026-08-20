package models

import (
	"context"
	"testing"
)

// TestGlobalSearchIncludesPengabdian memverifikasi bahwa santri berstatus
// 'pengabdian' muncul pada hasil pencarian global dengan tipe "santri",
// status 'pengabdian', dan khidmah_tempat terisi.
// Validates: Requirements 5.1
func TestGlobalSearchIncludesPengabdian(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	// Bersihkan tabel terkait.
	db.Exec(ctx, "TRUNCATE santri, riwayat_bagian, alumni CASCADE")

	// Insert santri berstatus 'pengabdian' dengan khidmah_tempat.
	var santriID int
	err := db.QueryRow(ctx,
		`INSERT INTO santri (nik, stambuk, nama, status, khidmah_tempat, khidmah_mulai)
		 VALUES ('SR001', 'STBSR001', 'Santri Pengabdian Search', 'pengabdian', 'Pondok Pusat - Kantor', '2025-07-01')
		 RETURNING id`).Scan(&santriID)
	if err != nil {
		t.Fatalf("insert santri pengabdian: %v", err)
	}

	// Cari berdasarkan nama.
	results, err := GlobalSearch(ctx, "Santri Pengabdian Search", "pimpinan")
	if err != nil {
		t.Fatalf("GlobalSearch failed: %v", err)
	}

	var found *SearchResult
	for i := range results {
		if results[i].Tipe == "santri" && results[i].ID == santriID {
			found = &results[i]
			break
		}
	}

	if found == nil {
		t.Fatalf("expected GlobalSearch to include the 'pengabdian' santri (id=%d), got %d results", santriID, len(results))
	}

	if found.Tipe != "santri" {
		t.Errorf("expected tipe 'santri', got %q", found.Tipe)
	}

	data, ok := found.DataUtama.(DataUtamaSantri)
	if !ok {
		t.Fatalf("expected DataUtama to be DataUtamaSantri, got %T", found.DataUtama)
	}

	if data.Status != "pengabdian" {
		t.Errorf("expected status 'pengabdian', got %q", data.Status)
	}
	if data.KhidmahTempat == nil {
		t.Fatalf("expected khidmah_tempat to be populated, got nil")
	}
	if *data.KhidmahTempat != "Pondok Pusat - Kantor" {
		t.Errorf("expected khidmah_tempat 'Pondok Pusat - Kantor', got %q", *data.KhidmahTempat)
	}

	// Cari juga berdasarkan stambuk untuk memastikan match keduanya.
	byStambuk, err := GlobalSearch(ctx, "STBSR001", "pimpinan")
	if err != nil {
		t.Fatalf("GlobalSearch by stambuk failed: %v", err)
	}
	var foundByStambuk bool
	for i := range byStambuk {
		if byStambuk[i].Tipe == "santri" && byStambuk[i].ID == santriID {
			foundByStambuk = true
			break
		}
	}
	if !foundByStambuk {
		t.Errorf("expected GlobalSearch by stambuk to include the 'pengabdian' santri (id=%d)", santriID)
	}
}
