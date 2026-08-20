package models

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"
)

// Feature: santri-pengabdian-khidmah, Property 1
//
// Property 1: Invarian pasca Mulai_Pengabdian
// Untuk setiap santri berstatus `aktif` dan setiap input khidmah valid (tempat
// non-kosong, tanggal mulai valid), setelah MulaiPengabdian berhasil maka
// SEKALIGUS berlaku:
//   - status santri menjadi `pengabdian`,
//   - `bagian_id` menjadi NULL,
//   - seluruh baris `riwayat_bagian` yang tanggal_selesai-nya kosong menjadi terisi,
//   - `khidmah_tempat` dan `khidmah_mulai` tersimpan sesuai input,
//   - TIDAK ada baris `alumni` yang dibuat untuk santri tersebut.
//
// Test ini DB-backed: mengikuti pola models/perpindahan_test.go &
// alumni_koersi_test.go (setupTestDB() + TRUNCATE ... CASCADE) dengan generator
// acak >= 100 iterasi (math/rand) untuk khidmah_tempat non-kosong dan tanggal
// mulai valid.
//
// Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
func TestPropertyMulaiPengabdianInvarian(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	// Bersihkan tabel terkait agar test deterministik.
	db.Exec(ctx, "TRUNCATE tingkatan, kelas, bagian, santri, riwayat_bagian, proses_keluar, alumni CASCADE")

	// Siapkan satu bagian valid (tingkatan + kelas + bagian) sebagai bagian_id
	// awal santri aktif.
	var tingkatanID, kelasID, bagianID int
	if err := db.QueryRow(ctx,
		`INSERT INTO tingkatan (nama, urutan) VALUES ('Tsanawiyah Prop1', 1) RETURNING id`).Scan(&tingkatanID); err != nil {
		t.Fatalf("insert tingkatan: %v", err)
	}
	if err := db.QueryRow(ctx,
		`INSERT INTO kelas (nama, tahun_masuk) VALUES ('1', '2023') RETURNING id`).Scan(&kelasID); err != nil {
		t.Fatalf("insert kelas: %v", err)
	}
	if err := db.QueryRow(ctx,
		`INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1, $2, 'Prop1-A') RETURNING id`,
		kelasID, tingkatanID).Scan(&bagianID); err != nil {
		t.Fatalf("insert bagian: %v", err)
	}

	rng := rand.New(rand.NewSource(1))

	// Generator tempat khidmah non-kosong (mengandung minimal satu non-spasi).
	letters := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ")
	genTempatValid := func() string {
		n := rng.Intn(20) + 1
		b := make([]rune, n)
		for i := range b {
			b[i] = letters[rng.Intn(len(letters))]
		}
		s := string(b)
		if strings.TrimSpace(s) == "" {
			s = "Pondok" + s // jamin ada karakter non-spasi
		}
		return s
	}

	// Generator tanggal mulai valid berformat "YYYY-MM-DD".
	genTanggalValid := func() string {
		yr := rng.Intn(80) + 1970 // 1970..2049
		mo := rng.Intn(12) + 1    // 1..12
		day := rng.Intn(28) + 1   // 1..28 (aman untuk semua bulan)
		return time.Date(yr, time.Month(mo), day, 0, 0, 0, 0, time.UTC).
			Format(tanggalKhidmahLayout)
	}

	const iterations = 120
	for i := 0; i < iterations; i++ {
		// Insert santri 'aktif' dengan bagian_id + satu baris riwayat_bagian terbuka.
		var santriID int
		nik := fmt.Sprintf("PROP1-NIK-%d", i)
		stb := fmt.Sprintf("PROP1-STB-%d", i)
		nama := fmt.Sprintf("Santri Prop1 %d", i)
		if err := db.QueryRow(ctx,
			`INSERT INTO santri (nik, stambuk, nama, bagian_id, status)
			 VALUES ($1, $2, $3, $4, 'aktif') RETURNING id`,
			nik, stb, nama, bagianID).Scan(&santriID); err != nil {
			t.Fatalf("iter %d: insert santri aktif: %v", i, err)
		}
		if _, err := db.Exec(ctx,
			`INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai)
			 VALUES ($1, $2, CURRENT_DATE)`, santriID, bagianID); err != nil {
			t.Fatalf("iter %d: insert riwayat_bagian: %v", i, err)
		}

		// Input khidmah acak yang valid.
		tempat := genTempatValid()
		mulai := genTanggalValid()

		if err := MulaiPengabdian(ctx, MulaiPengabdianInput{
			SantriID:      santriID,
			KhidmahTempat: tempat,
			KhidmahMulai:  mulai,
		}); err != nil {
			t.Fatalf("iter %d: MulaiPengabdian gagal (tempat=%q, mulai=%q): %v",
				i, tempat, mulai, err)
		}

		// ---- Assert invarian pasca Mulai_Pengabdian ----

		// (2.1) status menjadi 'pengabdian'.
		// (2.2) bagian_id menjadi NULL.
		// (2.4) khidmah_tempat & khidmah_mulai tersimpan sesuai input.
		var status string
		var bagianNull bool
		var khidmahTempat *string
		var khidmahMulai *time.Time
		if err := db.QueryRow(ctx,
			`SELECT status, (bagian_id IS NULL), khidmah_tempat, khidmah_mulai
			 FROM santri WHERE id = $1`, santriID).Scan(
			&status, &bagianNull, &khidmahTempat, &khidmahMulai); err != nil {
			t.Fatalf("iter %d: query santri pasca transisi: %v", i, err)
		}

		if status != "pengabdian" {
			t.Fatalf("iter %d: status = %q, want 'pengabdian' (Req 2.1)", i, status)
		}
		if !bagianNull {
			t.Fatalf("iter %d: bagian_id tidak NULL (Req 2.2)", i)
		}
		wantTempat := strings.TrimSpace(tempat)
		if khidmahTempat == nil || *khidmahTempat != wantTempat {
			got := "<nil>"
			if khidmahTempat != nil {
				got = *khidmahTempat
			}
			t.Fatalf("iter %d: khidmah_tempat = %q, want %q (Req 2.4)", i, got, wantTempat)
		}
		if khidmahMulai == nil {
			t.Fatalf("iter %d: khidmah_mulai nil, want %q (Req 2.4)", i, mulai)
		}
		if got := khidmahMulai.Format(tanggalKhidmahLayout); got != mulai {
			t.Fatalf("iter %d: khidmah_mulai = %q, want %q (Req 2.4)", i, got, mulai)
		}

		// (2.3) tidak ada baris riwayat_bagian yang masih terbuka bagi santri ini.
		var openRiwayat int
		if err := db.QueryRow(ctx,
			`SELECT COUNT(*) FROM riwayat_bagian
			 WHERE santri_id = $1 AND tanggal_selesai IS NULL`, santriID).Scan(&openRiwayat); err != nil {
			t.Fatalf("iter %d: query riwayat terbuka: %v", i, err)
		}
		if openRiwayat != 0 {
			t.Fatalf("iter %d: masih ada %d riwayat_bagian terbuka, want 0 (Req 2.3)",
				i, openRiwayat)
		}

		// (2.5) tidak ada baris alumni yang dibuat untuk santri ini.
		var alumniCount int
		if err := db.QueryRow(ctx,
			`SELECT COUNT(*) FROM alumni WHERE santri_id = $1`, santriID).Scan(&alumniCount); err != nil {
			t.Fatalf("iter %d: query alumni: %v", i, err)
		}
		if alumniCount != 0 {
			t.Fatalf("iter %d: terdapat %d baris alumni, want 0 (Req 2.5)", i, alumniCount)
		}
	}
}
