package models

import "testing"

// PertemuanKeHari: 1 pertemuan = ½ hari, akumulasi lalu ceil.
func TestPertemuanKeHari(t *testing.T) {
	cases := []struct {
		in   int
		want int
	}{
		{0, 0},
		{-3, 0},
		{1, 1},   // 0.5 → 1
		{2, 1},   // 1.0 → 1
		{3, 2},   // 1.5 → 2
		{19, 10}, // contoh: ghoib 19 → 10 hari
		{41, 21}, // contoh: hadir 41 → 21 hari
		{60, 30},
	}
	for _, c := range cases {
		if got := PertemuanKeHari(c.in); got != c.want {
			t.Errorf("PertemuanKeHari(%d) = %d, want %d", c.in, got, c.want)
		}
	}
}

// Ambang koreksi memakai HARI hasil pembulatan (khos & bayan).
func TestAmbangKoreksiHari(t *testing.T) {
	// Khos semester: izin ≥ 20 hari, alpha ≥ 6 hari.
	// 39 pertemuan izin → 20 hari → kena; 38 → 19 hari → tidak.
	if PertemuanKeHari(39) < 20 {
		t.Errorf("39 pertemuan harus ≥ 20 hari (got %d)", PertemuanKeHari(39))
	}
	if PertemuanKeHari(38) >= 20 {
		t.Errorf("38 pertemuan harus < 20 hari (got %d)", PertemuanKeHari(38))
	}
	// Bayan tahun: alpha ≥ 5 hari. 9 pertemuan → 5 hari → kena; 8 → 4 → tidak.
	if PertemuanKeHari(9) < 5 {
		t.Errorf("9 pertemuan harus ≥ 5 hari (got %d)", PertemuanKeHari(9))
	}
	if PertemuanKeHari(8) >= 5 {
		t.Errorf("8 pertemuan harus < 5 hari (got %d)", PertemuanKeHari(8))
	}
}
