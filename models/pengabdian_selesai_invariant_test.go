package models

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"
)

// Feature: santri-pengabdian-khidmah, Property 4
//
// Property 4: Invarian pasca Lepas_Pengabdian dan idempotensi alumni
// Untuk setiap santri berstatus `pengabdian` (dengan khidmah_tempat terisi) dan
// setiap tanggal selesai valid, setelah SelesaiPengabdian berhasil maka
// SEKALIGUS berlaku:
//   - status santri menjadi `lulus`,
//   - terdapat TEPAT SATU baris `alumni` untuk santri tersebut dengan
//     `tahun_lulus` terisi,
//   - `alumni.khidmah` sama dengan `khidmah_tempat` santri,
//   - `khidmah_selesai` terisi sesuai input.
// Menjalankan operasi pada santri yang sudah memiliki baris `alumni` tidak
// menggandakan baris tersebut (idempotensi, Requirement 3.7).
//
// Test ini DB-backed: mengikuti pola models/perpindahan_test.go &
// alumni_koersi_test.go (setupTestDB() + TRUNCATE ... CASCADE) dengan generator
// acak >= 100 iterasi (math/rand) untuk khidmah_tempat, khidmah_mulai, dan
// khidmah_selesai yang valid.
//
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.7
func TestPropertySelesaiPengabdianInvarianDanIdempotensi(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	// Bersihkan tabel terkait agar test deterministik.
	db.Exec(ctx, "TRUNCATE tingkatan, kelas, bagian, santri, riwayat_bagian, proses_keluar, alumni CASCADE")

	rng := rand.New(rand.NewSource(4))

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

	// Generator tanggal valid berformat "YYYY-MM-DD".
	genTanggalValid := func() string {
		yr := rng.Intn(80) + 1970 // 1970..2049
		mo := rng.Intn(12) + 1    // 1..12
		day := rng.Intn(28) + 1   // 1..28 (aman untuk semua bulan)
		return time.Date(yr, time.Month(mo), day, 0, 0, 0, 0, time.UTC).
			Format(tanggalKhidmahLayout)
	}

	tahunSekarang := time.Now().Format("2006")

	const iterations = 120
	for i := 0; i < iterations; i++ {
		// Insert santri langsung berstatus 'pengabdian' dengan khidmah terisi.
		var santriID int
		nik := fmt.Sprintf("PROP4-NIK-%d", i)
		stb := fmt.Sprintf("PROP4-STB-%d", i)
		nama := fmt.Sprintf("Santri Prop4 %d", i)
		tempat := genTempatValid()
		mulai := genTanggalValid()
		if err := db.QueryRow(ctx,
			`INSERT INTO santri (nik, stambuk, nama, bagian_id, status,
			                     khidmah_tempat, khidmah_mulai)
			 VALUES ($1, $2, $3, NULL, 'pengabdian', $4, $5) RETURNING id`,
			nik, stb, nama, tempat, mulai).Scan(&santriID); err != nil {
			t.Fatalf("iter %d: insert santri pengabdian: %v", i, err)
		}

		// Tanggal selesai khidmah acak yang valid.
		selesai := genTanggalValid()

		if err := SelesaiPengabdian(ctx, SelesaiPengabdianInput{
			SantriID:       santriID,
			KhidmahSelesai: selesai,
		}); err != nil {
			t.Fatalf("iter %d: SelesaiPengabdian gagal (selesai=%q): %v", i, selesai, err)
		}

		// ---- Assert invarian pasca Lepas_Pengabdian ----

		// (3.1) status menjadi 'lulus'.
		// (3.4) khidmah_selesai terisi sesuai input.
		var status string
		var khidmahSelesai *time.Time
		var khidmahTempat *string
		if err := db.QueryRow(ctx,
			`SELECT status, khidmah_selesai, khidmah_tempat
			 FROM santri WHERE id = $1`, santriID).Scan(
			&status, &khidmahSelesai, &khidmahTempat); err != nil {
			t.Fatalf("iter %d: query santri pasca transisi: %v", i, err)
		}
		if status != "lulus" {
			t.Fatalf("iter %d: status = %q, want 'lulus' (Req 3.1)", i, status)
		}
		if khidmahSelesai == nil {
			t.Fatalf("iter %d: khidmah_selesai nil, want %q (Req 3.4)", i, selesai)
		}
		if got := khidmahSelesai.Format(tanggalKhidmahLayout); got != selesai {
			t.Fatalf("iter %d: khidmah_selesai = %q, want %q (Req 3.4)", i, got, selesai)
		}

		// (3.2) tepat satu baris alumni dengan tahun_lulus terisi.
		// (3.3) alumni.khidmah == khidmah_tempat santri.
		var alumniCount int
		if err := db.QueryRow(ctx,
			`SELECT COUNT(*) FROM alumni WHERE santri_id = $1`, santriID).Scan(&alumniCount); err != nil {
			t.Fatalf("iter %d: query jumlah alumni: %v", i, err)
		}
		if alumniCount != 1 {
			t.Fatalf("iter %d: jumlah alumni = %d, want 1 (Req 3.2)", i, alumniCount)
		}

		var tahunLulus *string
		var alumniKhidmah *string
		if err := db.QueryRow(ctx,
			`SELECT tahun_lulus, khidmah FROM alumni WHERE santri_id = $1`, santriID).Scan(
			&tahunLulus, &alumniKhidmah); err != nil {
			t.Fatalf("iter %d: query baris alumni: %v", i, err)
		}
		if tahunLulus == nil || strings.TrimSpace(*tahunLulus) == "" {
			t.Fatalf("iter %d: tahun_lulus kosong, want terisi (Req 3.2)", i)
		}
		if *tahunLulus != tahunSekarang {
			t.Fatalf("iter %d: tahun_lulus = %q, want %q (Req 3.2)", i, *tahunLulus, tahunSekarang)
		}
		// alumni.khidmah harus sama dengan khidmah_tempat santri (yang tersimpan).
		if khidmahTempat == nil {
			t.Fatalf("iter %d: khidmah_tempat santri nil, tidak dapat diverifikasi (Req 3.3)", i)
		}
		if alumniKhidmah == nil || *alumniKhidmah != *khidmahTempat {
			got := "<nil>"
			if alumniKhidmah != nil {
				got = *alumniKhidmah
			}
			t.Fatalf("iter %d: alumni.khidmah = %q, want %q (Req 3.3)", i, got, *khidmahTempat)
		}

		// ---- Idempotensi (Req 3.7): panggilan kedua tidak menggandakan alumni ----
		// Panggilan kedua akan gagal guard status (status kini 'lulus', bukan
		// 'pengabdian'). Yang penting: jumlah baris alumni tetap 1.
		_ = SelesaiPengabdian(ctx, SelesaiPengabdianInput{
			SantriID:       santriID,
			KhidmahSelesai: selesai,
		})
		var alumniCountAfter int
		if err := db.QueryRow(ctx,
			`SELECT COUNT(*) FROM alumni WHERE santri_id = $1`, santriID).Scan(&alumniCountAfter); err != nil {
			t.Fatalf("iter %d: query jumlah alumni pasca panggilan kedua: %v", i, err)
		}
		if alumniCountAfter != 1 {
			t.Fatalf("iter %d: jumlah alumni pasca panggilan kedua = %d, want 1 (Req 3.7)",
				i, alumniCountAfter)
		}
	}

	// ---- Idempotensi eksplisit: baris alumni SUDAH ada sebelum SelesaiPengabdian ----
	// Verifikasi ON CONFLICT DO NOTHING pada santri 'pengabdian' yang telanjur
	// memiliki baris alumni (Requirement 3.7): baris tidak digandakan dan nilai
	// khidmah pra-ada dipertahankan.
	for i := 0; i < 20; i++ {
		var santriID int
		nik := fmt.Sprintf("PROP4B-NIK-%d", i)
		stb := fmt.Sprintf("PROP4B-STB-%d", i)
		nama := fmt.Sprintf("Santri Prop4B %d", i)
		tempat := genTempatValid()
		mulai := genTanggalValid()
		if err := db.QueryRow(ctx,
			`INSERT INTO santri (nik, stambuk, nama, bagian_id, status,
			                     khidmah_tempat, khidmah_mulai)
			 VALUES ($1, $2, $3, NULL, 'pengabdian', $4, $5) RETURNING id`,
			nik, stb, nama, tempat, mulai).Scan(&santriID); err != nil {
			t.Fatalf("idempotensi iter %d: insert santri pengabdian: %v", i, err)
		}

		// Pra-insert baris alumni dengan nilai khidmah yang berbeda.
		khidmahPraAda := "PRA-ADA-" + tempat
		if _, err := db.Exec(ctx,
			`INSERT INTO alumni (santri_id, tahun_lulus, khidmah)
			 VALUES ($1, '2000', $2)`, santriID, khidmahPraAda); err != nil {
			t.Fatalf("idempotensi iter %d: pra-insert alumni: %v", i, err)
		}

		selesai := genTanggalValid()
		if err := SelesaiPengabdian(ctx, SelesaiPengabdianInput{
			SantriID:       santriID,
			KhidmahSelesai: selesai,
		}); err != nil {
			t.Fatalf("idempotensi iter %d: SelesaiPengabdian gagal: %v", i, err)
		}

		// Status tetap berpindah ke 'lulus'.
		var status string
		db.QueryRow(ctx, `SELECT status FROM santri WHERE id = $1`, santriID).Scan(&status)
		if status != "lulus" {
			t.Fatalf("idempotensi iter %d: status = %q, want 'lulus' (Req 3.1)", i, status)
		}

		// Baris alumni tidak digandakan (tetap tepat satu) dan nilai pra-ada
		// dipertahankan (ON CONFLICT DO NOTHING).
		var alumniCount int
		var alumniKhidmah *string
		var tahunLulus *string
		if err := db.QueryRow(ctx,
			`SELECT COUNT(*) OVER (), khidmah, tahun_lulus
			 FROM alumni WHERE santri_id = $1`, santriID).Scan(
			&alumniCount, &alumniKhidmah, &tahunLulus); err != nil {
			t.Fatalf("idempotensi iter %d: query alumni: %v", i, err)
		}
		if alumniCount != 1 {
			t.Fatalf("idempotensi iter %d: jumlah alumni = %d, want 1 (Req 3.7)", i, alumniCount)
		}
		if alumniKhidmah == nil || *alumniKhidmah != khidmahPraAda {
			got := "<nil>"
			if alumniKhidmah != nil {
				got = *alumniKhidmah
			}
			t.Fatalf("idempotensi iter %d: alumni.khidmah = %q, want %q (baris pra-ada dipertahankan, Req 3.7)",
				i, got, khidmahPraAda)
		}
	}
}
