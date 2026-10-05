package models

import (
	"context"
	"time"

	"github.com/mubtadiaat/app/config"
)

// PenempatanTA adalah penempatan santri SELAMA tahun ajaran tertentu.
// Sumber kebenarannya riwayat_bagian (rentang tanggal) yang beririsan dengan
// kalender_kuartal tahun ajaran tsb — BUKAN santri.bagian_id (posisi sekarang).
type PenempatanTA struct {
	BagianID      int    `json:"bagian_id"`
	Tingkatan     string `json:"tingkatan"`   // "Tsanawiyah"
	Kelas         string `json:"kelas"`       // "3"
	NamaBagian    string `json:"nama_bagian"` // "3 Tsanawiyah A" (format sama dg query riwayat)
	BagianRincian string `json:"bagian_rincian"` // "A" (hanya nama bagian, utk kepala raport)
}

// KelasPadaTA mengembalikan peta santri_id → penempatan pada tahun ajaran tsb.
//
// Cuma santri yang punya baris riwayat_bagian beririsan dengan TA tsb yang
// masuk peta. Pemanggil WAJIB fallback ke penempatan saat ini bila santri tidak
// ditemukan (riwayat belum lengkap / TA belum punya kalender) — dengan begitu
// perbaikan ini tidak pernah membuat data yang tadinya tampil jadi hilang.
//
// Urutan pemilihan bila ada beberapa penempatan yang beririsan dengan TA:
//   tanggal_selesai DESC (NULL = masih aktif duluan), lalu tanggal_mulai DESC.
// Artinya yang dipakai adalah penempatan saat TA tsb BERAKHIR — yang berlaku
// untuk penilaian/raport akhir tahun. (Baris yang tanggal_mulainya sudah jatuh
// SETELAH rentang TA otomatis gugur lewat uji irisan.)
//
// Kenapa ada fungsi ini: sebelumnya target Juz Amma, kategori kompetensi dan
// label bagian di raport dihitung dari kelas SEKARANG, sehingga riwayat tahun
// lama ikut berubah mengikuti kelas baru setelah santri naik kelas
// (bug owner 2026-10-05).
func KelasPadaTA(ctx context.Context, santriIDs []int, tahunAjaran string) (map[int]PenempatanTA, error) {
	out := map[int]PenempatanTA{}
	if len(santriIDs) == 0 || tahunAjaran == "" {
		return out, nil
	}

	var mulai, selesai time.Time
	if err := config.DB.QueryRow(ctx,
		`SELECT MIN(tgl_mulai), MAX(tgl_selesai) FROM kalender_kuartal WHERE tahun_ajaran = $1`,
		tahunAjaran).Scan(&mulai, &selesai); err != nil || mulai.IsZero() {
		// TA tak dikenal kalender → diamkan; pemanggil pakai kelas sekarang.
		return out, nil
	}

	rows, err := config.DB.Query(ctx, `
		SELECT r.santri_id, r.bagian_id, r.tanggal_mulai, r.tanggal_selesai,
		       COALESCE(t.nama, ''), COALESCE(k.nama, ''), COALESCE(b.nama_bagian, ''),
		       TRIM(k.nama || ' ' || COALESCE(t.nama, '') || ' ' || COALESCE(b.nama_bagian, ''))
		FROM riwayat_bagian r
		JOIN bagian b         ON b.id = r.bagian_id
		JOIN kelas k          ON k.id = b.kelas_id
		LEFT JOIN tingkatan t ON t.id = b.tingkatan_id
		WHERE r.santri_id = ANY($1)
		ORDER BY r.santri_id, r.tanggal_selesai DESC, r.tanggal_mulai DESC`,
		santriIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	seen := map[int]bool{}
	for rows.Next() {
		var sid, bid int
		var tglMulai time.Time
		var tglSelesai *time.Time
		var tingkatan, kelas, bagianRincian, namaBagian string
		if err := rows.Scan(&sid, &bid, &tglMulai, &tglSelesai, &tingkatan, &kelas, &bagianRincian, &namaBagian); err != nil {
			return nil, err
		}
		// Baris sudah terurut; yang pertama kali beririsan itulah penempatan
		// pada TA ini, jadi santri yang sudah keisi tidak diproses lagi.
		if seen[sid] {
			continue
		}
		akhir := time.Now().AddDate(100, 0, 0) // masih aktif
		if tglSelesai != nil {
			akhir = *tglSelesai
		}
		if tglMulai.After(selesai) || akhir.Before(mulai) {
			continue // tidak beririsan
		}
		seen[sid] = true
		out[sid] = PenempatanTA{
			BagianID:      bid,
			Tingkatan:     tingkatan,
			Kelas:         kelas,
			NamaBagian:    namaBagian,
			BagianRincian: bagianRincian,
		}
	}
	return out, rows.Err()
}

// KelasPadaTA1 versi satu santri (untuk jalur simpan).
func KelasPadaTA1(ctx context.Context, santriID int, tahunAjaran string) (PenempatanTA, error) {
	m, err := KelasPadaTA(ctx, []int{santriID}, tahunAjaran)
	if err != nil {
		return PenempatanTA{}, err
	}
	return m[santriID], nil
}
