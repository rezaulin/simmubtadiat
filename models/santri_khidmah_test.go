package models

import (
	"context"
	"strconv"
	"testing"
)

// TestGetSantriByIDKhidmah memverifikasi bahwa GetSantriByID mengembalikan data
// khidmah (khidmah_tempat, khidmah_mulai) untuk santri berstatus 'pengabdian'.
// Validates: Requirements 10.1, 10.2, 10.3 (kolom khidmah termuat pada model Santri)
func TestGetSantriByIDKhidmah(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	// Bersihkan tabel terkait.
	db.Exec(ctx, "TRUNCATE santri, riwayat_bagian, alumni CASCADE")

	// Insert santri 'pengabdian' dengan data khidmah.
	var santriID int
	err := db.QueryRow(ctx,
		`INSERT INTO santri (nik, stambuk, nama, status, khidmah_tempat, khidmah_mulai)
		 VALUES ('KH001', 'STBKH001', 'Santri Khidmah', 'pengabdian', 'Pondok Pusat - Dapur Umum', '2025-07-01')
		 RETURNING id`).Scan(&santriID)
	if err != nil {
		t.Fatalf("insert santri pengabdian: %v", err)
	}

	s, err := GetSantriByID(ctx, strconv.Itoa(santriID), "pimpinan", 0)
	if err != nil {
		t.Fatalf("GetSantriByID failed: %v", err)
	}

	if s.Status != "pengabdian" {
		t.Errorf("expected status 'pengabdian', got %q", s.Status)
	}
	if s.KhidmahTempat == nil {
		t.Fatalf("expected khidmah_tempat to be populated, got nil")
	}
	if *s.KhidmahTempat != "Pondok Pusat - Dapur Umum" {
		t.Errorf("expected khidmah_tempat 'Pondok Pusat - Dapur Umum', got %q", *s.KhidmahTempat)
	}
	if s.KhidmahMulai == nil {
		t.Fatalf("expected khidmah_mulai to be populated, got nil")
	}
	if got := s.KhidmahMulai.Format("2006-01-02"); got != "2025-07-01" {
		t.Errorf("expected khidmah_mulai '2025-07-01', got %q", got)
	}
	// khidmah_selesai belum diisi untuk santri yang masih berstatus pengabdian.
	if s.KhidmahSelesai != nil {
		t.Errorf("expected khidmah_selesai to be nil, got %v", *s.KhidmahSelesai)
	}
}

// TestGetSantriAktifExcludesPengabdian memverifikasi bahwa GetSantriAktif hanya
// memuat santri berstatus 'aktif' dan tidak memuat santri berstatus 'pengabdian'.
// Validates: Requirements 10.1, 10.2, 10.3
func TestGetSantriAktifExcludesPengabdian(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	// Bersihkan tabel terkait.
	db.Exec(ctx, "TRUNCATE santri, riwayat_bagian, alumni CASCADE")

	// Santri aktif.
	var aktifID int
	err := db.QueryRow(ctx,
		`INSERT INTO santri (nik, stambuk, nama, status)
		 VALUES ('KH100', 'STBKH100', 'Santri Aktif', 'aktif') RETURNING id`).Scan(&aktifID)
	if err != nil {
		t.Fatalf("insert santri aktif: %v", err)
	}

	// Santri pengabdian.
	var pengabdianID int
	err = db.QueryRow(ctx,
		`INSERT INTO santri (nik, stambuk, nama, status, khidmah_tempat, khidmah_mulai)
		 VALUES ('KH101', 'STBKH101', 'Santri Pengabdian', 'pengabdian', 'Pondok Pusat', '2025-07-01')
		 RETURNING id`).Scan(&pengabdianID)
	if err != nil {
		t.Fatalf("insert santri pengabdian: %v", err)
	}

	list, err := GetSantriAktif(ctx, "pimpinan", 0, SantriFilter{})
	if err != nil {
		t.Fatalf("GetSantriAktif failed: %v", err)
	}

	var foundAktif, foundPengabdian bool
	for _, s := range list {
		switch s.ID {
		case aktifID:
			foundAktif = true
		case pengabdianID:
			foundPengabdian = true
		}
	}

	if !foundAktif {
		t.Errorf("expected GetSantriAktif to include the 'aktif' santri (id=%d)", aktifID)
	}
	if foundPengabdian {
		t.Errorf("expected GetSantriAktif to NOT include the 'pengabdian' santri (id=%d)", pengabdianID)
	}
}
