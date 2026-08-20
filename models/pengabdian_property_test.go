package models

import (
	"math/rand"
	"strings"
	"testing"
	"time"
)

// Feature: santri-pengabdian-khidmah, Property 6
//
// Property 6: Koersi status keluar berbasis Kelas_Akhir
// Untuk setiap kombinasi status yang diminta (`lulus`, `boyong`, `keluar`) dan
// penanda Kelas_Akhir (benar/salah), fungsi resolveStatusKeluar menghasilkan
// `lulus` bila status diminta `boyong` dan santri berada di Kelas_Akhir, dan
// mengembalikan status yang diminta apa adanya pada semua kasus lain.
//
// Validates: Requirements 4.3, 4.4, 4.5
func TestPropertyResolveStatusKeluar(t *testing.T) {
	// Ruang input status yang diminta pada proses keluar santri.
	statuses := []string{"lulus", "boyong", "keluar"}
	rng := rand.New(rand.NewSource(6))

	const iterations = 200
	for i := 0; i < iterations; i++ {
		status := statuses[rng.Intn(len(statuses))]
		isAkhir := rng.Intn(2) == 1

		got := resolveStatusKeluar(status, isAkhir)

		// Oracle independen: hanya kombinasi boyong + Kelas_Akhir yang dikoersi
		// menjadi lulus; sisanya dikembalikan apa adanya.
		want := status
		if status == "boyong" && isAkhir {
			want = "lulus"
		}

		if got != want {
			t.Fatalf("iter %d: resolveStatusKeluar(%q, %v) = %q, want %q",
				i, status, isAkhir, got, want)
		}

		// Invarian tambahan: koersi ke lulus HANYA terjadi pada boyong+Kelas_Akhir.
		if got == "lulus" && status != "lulus" {
			if !(status == "boyong" && isAkhir) {
				t.Fatalf("iter %d: koersi tak terduga ke lulus dari (%q, %v)",
					i, status, isAkhir)
			}
		}
	}
}

// Feature: santri-pengabdian-khidmah, Property 6 (pendukung)
//
// Verifikasi kasus eksplisit dari tabel kebenaran koersi status keluar untuk
// memastikan tiap kombinasi (status × Kelas_Akhir) berperilaku sesuai spesifikasi.
func TestResolveStatusKeluarTruthTable(t *testing.T) {
	cases := []struct {
		status  string
		isAkhir bool
		want    string
	}{
		{"boyong", true, "lulus"},   // dikoersi (Requirement 4.3)
		{"boyong", false, "boyong"}, // tetap boyong (Requirement 4.4)
		{"keluar", true, "keluar"},  // keluar tak pernah dikoersi (Requirement 4.5)
		{"keluar", false, "keluar"}, // tetap keluar (Requirement 4.5)
		{"lulus", true, "lulus"},    // tetap lulus
		{"lulus", false, "lulus"},   // tetap lulus
	}

	for _, c := range cases {
		if got := resolveStatusKeluar(c.status, c.isAkhir); got != c.want {
			t.Errorf("resolveStatusKeluar(%q, %v) = %q, want %q",
				c.status, c.isAkhir, got, c.want)
		}
	}
}

// Feature: santri-pengabdian-khidmah, Property 2
//
// Property 2: Validasi input Mulai_Pengabdian
// Untuk setiap input Mulai_Pengabdian yang tempat khidmahnya kosong/whitespace
// saja ATAU tanggal mulainya kosong/tak valid, ValidateMulaiPengabdian
// menghasilkan error. Sebaliknya, input dengan tempat non-kosong dan tanggal
// mulai berformat "YYYY-MM-DD" yang valid menghasilkan nil.
//
// Validates: Requirements 2.6, 2.7
func TestPropertyValidateMulaiPengabdian(t *testing.T) {
	rng := rand.New(rand.NewSource(2))

	// Generator string whitespace-only/kosong: rangkaian acak dari spasi, tab,
	// newline, carriage return (atau string benar-benar kosong).
	wsRunes := []rune{' ', '\t', '\n', '\r'}
	genWhitespace := func() string {
		n := rng.Intn(5) // 0..4 → termasuk string kosong
		b := make([]rune, n)
		for i := range b {
			b[i] = wsRunes[rng.Intn(len(wsRunes))]
		}
		return string(b)
	}

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
		yr := rng.Intn(80) + 1970       // 1970..2049
		mo := rng.Intn(12) + 1          // 1..12
		day := rng.Intn(28) + 1         // 1..28 (aman untuk semua bulan)
		return time.Date(yr, time.Month(mo), day, 0, 0, 0, 0, time.UTC).
			Format(tanggalKhidmahLayout)
	}

	// Generator string tanggal tak valid: string non-date acak yang bukan
	// format "YYYY-MM-DD" yang dapat di-parse.
	junkRunes := []rune("abcdefghij0123456789/-. :")
	genTanggalInvalid := func() string {
		for {
			n := rng.Intn(12)
			b := make([]rune, n)
			for i := range b {
				b[i] = junkRunes[rng.Intn(len(junkRunes))]
			}
			s := string(b)
			// Pastikan benar-benar tak valid (bukan kebetulan format tanggal sah).
			if strings.TrimSpace(s) == "" {
				return s // string kosong/whitespace juga tak valid → OK
			}
			if _, err := time.Parse(tanggalKhidmahLayout, strings.TrimSpace(s)); err != nil {
				return s
			}
		}
	}

	const iterations = 150
	for i := 0; i < iterations; i++ {
		// Kasus (a): tempat kosong/whitespace + tanggal apa pun → HARUS error.
		inA := MulaiPengabdianInput{
			SantriID:      rng.Intn(1000) + 1,
			KhidmahTempat: genWhitespace(),
			KhidmahMulai:  genTanggalValid(),
		}
		if err := ValidateMulaiPengabdian(inA); err == nil {
			t.Fatalf("iter %d (a): tempat kosong/whitespace %q seharusnya menghasilkan error",
				i, inA.KhidmahTempat)
		}

		// Kasus (b): tempat valid + tanggal mulai kosong/tak valid → HARUS error.
		inB := MulaiPengabdianInput{
			SantriID:      rng.Intn(1000) + 1,
			KhidmahTempat: genTempatValid(),
			KhidmahMulai:  genTanggalInvalid(),
		}
		if err := ValidateMulaiPengabdian(inB); err == nil {
			t.Fatalf("iter %d (b): tanggal mulai tak valid %q seharusnya menghasilkan error",
				i, inB.KhidmahMulai)
		}

		// Kasus valid: tempat non-kosong + tanggal valid → HARUS nil.
		inOK := MulaiPengabdianInput{
			SantriID:      rng.Intn(1000) + 1,
			KhidmahTempat: genTempatValid(),
			KhidmahMulai:  genTanggalValid(),
		}
		if err := ValidateMulaiPengabdian(inOK); err != nil {
			t.Fatalf("iter %d (valid): input sah (tempat=%q, mulai=%q) seharusnya nil, dapat: %v",
				i, inOK.KhidmahTempat, inOK.KhidmahMulai, err)
		}
	}
}

// Feature: santri-pengabdian-khidmah, Property 5
//
// Property 5: Validasi input Lepas_Pengabdian
// Untuk setiap input Lepas_Pengabdian yang tanggal selesainya kosong/whitespace
// saja ATAU tak valid, ValidateSelesaiPengabdian menghasilkan error. Sebaliknya,
// input dengan tanggal selesai berformat "YYYY-MM-DD" yang valid menghasilkan nil.
//
// Validates: Requirements 3.5
func TestPropertyValidateSelesaiPengabdian(t *testing.T) {
	rng := rand.New(rand.NewSource(5))

	// Generator string whitespace-only/kosong: rangkaian acak dari spasi, tab,
	// newline, carriage return (atau string benar-benar kosong).
	wsRunes := []rune{' ', '\t', '\n', '\r'}
	genWhitespace := func() string {
		n := rng.Intn(5) // 0..4 → termasuk string kosong
		b := make([]rune, n)
		for i := range b {
			b[i] = wsRunes[rng.Intn(len(wsRunes))]
		}
		return string(b)
	}

	// Generator tanggal valid berformat "YYYY-MM-DD".
	genTanggalValid := func() string {
		yr := rng.Intn(80) + 1970 // 1970..2049
		mo := rng.Intn(12) + 1    // 1..12
		day := rng.Intn(28) + 1   // 1..28 (aman untuk semua bulan)
		return time.Date(yr, time.Month(mo), day, 0, 0, 0, 0, time.UTC).
			Format(tanggalKhidmahLayout)
	}

	// Generator string tanggal tak valid: string non-date acak yang bukan
	// format "YYYY-MM-DD" yang dapat di-parse.
	junkRunes := []rune("abcdefghij0123456789/-. :")
	genTanggalInvalid := func() string {
		for {
			n := rng.Intn(12)
			b := make([]rune, n)
			for i := range b {
				b[i] = junkRunes[rng.Intn(len(junkRunes))]
			}
			s := string(b)
			// Pastikan benar-benar tak valid (bukan kebetulan format tanggal sah).
			if strings.TrimSpace(s) == "" {
				return s // string kosong/whitespace juga tak valid → OK
			}
			if _, err := time.Parse(tanggalKhidmahLayout, strings.TrimSpace(s)); err != nil {
				return s
			}
		}
	}

	const iterations = 150
	for i := 0; i < iterations; i++ {
		// Kasus (a): tanggal selesai kosong/whitespace → HARUS error.
		inA := SelesaiPengabdianInput{
			SantriID:       rng.Intn(1000) + 1,
			KhidmahSelesai: genWhitespace(),
		}
		if err := ValidateSelesaiPengabdian(inA); err == nil {
			t.Fatalf("iter %d (a): tanggal selesai kosong/whitespace %q seharusnya menghasilkan error",
				i, inA.KhidmahSelesai)
		}

		// Kasus (b): tanggal selesai junk/tak valid → HARUS error.
		inB := SelesaiPengabdianInput{
			SantriID:       rng.Intn(1000) + 1,
			KhidmahSelesai: genTanggalInvalid(),
		}
		if err := ValidateSelesaiPengabdian(inB); err == nil {
			t.Fatalf("iter %d (b): tanggal selesai tak valid %q seharusnya menghasilkan error",
				i, inB.KhidmahSelesai)
		}

		// Kasus valid: tanggal selesai berformat "YYYY-MM-DD" → HARUS nil.
		inOK := SelesaiPengabdianInput{
			SantriID:       rng.Intn(1000) + 1,
			KhidmahSelesai: genTanggalValid(),
		}
		if err := ValidateSelesaiPengabdian(inOK); err != nil {
			t.Fatalf("iter %d (valid): input sah (selesai=%q) seharusnya nil, dapat: %v",
				i, inOK.KhidmahSelesai, err)
		}
	}
}
