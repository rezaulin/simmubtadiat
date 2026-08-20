package models

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"
)

// Feature: santri-pengabdian-khidmah, Property 3
//
// Property 3: Guard status awal transisi khidmah
// Untuk setiap santri yang statusnya BUKAN `aktif`, MulaiPengabdian gagal tanpa
// mengubah state; dan untuk setiap santri yang statusnya BUKAN `pengabdian`,
// SelesaiPengabdian gagal tanpa mengubah state dan tanpa menambah baris `alumni`.
//
// Test ini DB-backed: mengikuti pola models/perpindahan_test.go,
// pengabdian_invariant_test.go & pengabdian_selesai_invariant_test.go
// (setupTestDB() + TRUNCATE ... CASCADE) dengan generator acak >= 100 iterasi
// (math/rand). Input khidmah yang diberikan SELALU valid, sehingga kegagalan
// murni disebabkan guard status awal (RowsAffected=0), bukan validasi input.
//
// Validates: Requirements 2.8, 3.6
func TestPropertyGuardStatusAwalTransisi(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	// Bersihkan tabel terkait agar test deterministik.
	db.Exec(ctx, "TRUNCATE tingkatan, kelas, bagian, santri, riwayat_bagian, proses_keluar, alumni CASCADE")

	rng := rand.New(rand.NewSource(3))

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

	// Status yang bukan `aktif` (guard MulaiPengabdian) — subset dari CHECK
	// constraint santri.status yang sah pada migrasi 020.
	nonAktif := []string{"cuti", "pengabdian", "lulus", "boyong", "keluar"}
	// Status yang bukan `pengabdian` (guard SelesaiPengabdian).
	nonPengabdian := []string{"aktif", "cuti", "lulus", "boyong", "keluar"}

	const iterations = 120

	// ---- Guard MulaiPengabdian: status awal bukan `aktif` (Requirement 2.8) ----
	for i := 0; i < iterations; i++ {
		status := nonAktif[rng.Intn(len(nonAktif))]

		// Insert santri dengan status non-aktif acak. bagian_id sengaja NULL agar
		// tidak melanggar asumsi apa pun; kolom khidmah dikosongkan.
		var santriID int
		nik := fmt.Sprintf("PROP3M-NIK-%d", i)
		stb := fmt.Sprintf("PROP3M-STB-%d", i)
		nama := fmt.Sprintf("Santri Prop3M %d", i)
		if err := db.QueryRow(ctx,
			`INSERT INTO santri (nik, stambuk, nama, bagian_id, status)
			 VALUES ($1, $2, $3, NULL, $4) RETURNING id`,
			nik, stb, nama, status).Scan(&santriID); err != nil {
			t.Fatalf("iter %d: insert santri status %q: %v", i, status, err)
		}

		// Input khidmah valid → satu-satunya alasan gagal adalah guard status.
		tempat := genTempatValid()
		mulai := genTanggalValid()
		err := MulaiPengabdian(ctx, MulaiPengabdianInput{
			SantriID:      santriID,
			KhidmahTempat: tempat,
			KhidmahMulai:  mulai,
		})
		if err == nil {
			t.Fatalf("iter %d: MulaiPengabdian pada status %q berhasil, want error (Req 2.8)",
				i, status)
		}

		// State santri harus tidak berubah: status tetap, khidmah tetap kosong.
		var gotStatus string
		var khidmahTempat *string
		var khidmahMulai *time.Time
		if err := db.QueryRow(ctx,
			`SELECT status, khidmah_tempat, khidmah_mulai FROM santri WHERE id = $1`,
			santriID).Scan(&gotStatus, &khidmahTempat, &khidmahMulai); err != nil {
			t.Fatalf("iter %d: query santri pasca guard: %v", i, err)
		}
		if gotStatus != status {
			t.Fatalf("iter %d: status berubah menjadi %q, want tetap %q (Req 2.8)",
				i, gotStatus, status)
		}
		if khidmahTempat != nil {
			t.Fatalf("iter %d: khidmah_tempat terisi (%q) padahal transisi ditolak (Req 2.8)",
				i, *khidmahTempat)
		}
		if khidmahMulai != nil {
			t.Fatalf("iter %d: khidmah_mulai terisi padahal transisi ditolak (Req 2.8)", i)
		}
	}

	// ---- Guard SelesaiPengabdian: status awal bukan `pengabdian` (Requirement 3.6) ----
	for i := 0; i < iterations; i++ {
		status := nonPengabdian[rng.Intn(len(nonPengabdian))]

		var santriID int
		nik := fmt.Sprintf("PROP3S-NIK-%d", i)
		stb := fmt.Sprintf("PROP3S-STB-%d", i)
		nama := fmt.Sprintf("Santri Prop3S %d", i)
		if err := db.QueryRow(ctx,
			`INSERT INTO santri (nik, stambuk, nama, bagian_id, status)
			 VALUES ($1, $2, $3, NULL, $4) RETURNING id`,
			nik, stb, nama, status).Scan(&santriID); err != nil {
			t.Fatalf("iter %d: insert santri status %q: %v", i, status, err)
		}

		// Tanggal selesai valid → satu-satunya alasan gagal adalah guard status.
		selesai := genTanggalValid()
		err := SelesaiPengabdian(ctx, SelesaiPengabdianInput{
			SantriID:       santriID,
			KhidmahSelesai: selesai,
		})
		if err == nil {
			t.Fatalf("iter %d: SelesaiPengabdian pada status %q berhasil, want error (Req 3.6)",
				i, status)
		}

		// State santri tidak berubah: status tetap, khidmah_selesai tetap kosong.
		var gotStatus string
		var khidmahSelesai *time.Time
		if err := db.QueryRow(ctx,
			`SELECT status, khidmah_selesai FROM santri WHERE id = $1`,
			santriID).Scan(&gotStatus, &khidmahSelesai); err != nil {
			t.Fatalf("iter %d: query santri pasca guard: %v", i, err)
		}
		if gotStatus != status {
			t.Fatalf("iter %d: status berubah menjadi %q, want tetap %q (Req 3.6)",
				i, gotStatus, status)
		}
		if khidmahSelesai != nil {
			t.Fatalf("iter %d: khidmah_selesai terisi padahal transisi ditolak (Req 3.6)", i)
		}

		// Tidak ada baris alumni yang dibuat untuk santri ini (Req 3.6).
		var alumniCount int
		if err := db.QueryRow(ctx,
			`SELECT COUNT(*) FROM alumni WHERE santri_id = $1`, santriID).Scan(&alumniCount); err != nil {
			t.Fatalf("iter %d: query alumni pasca guard: %v", i, err)
		}
		if alumniCount != 0 {
			t.Fatalf("iter %d: terdapat %d baris alumni padahal transisi ditolak (Req 3.6)",
				i, alumniCount)
		}
	}
}
