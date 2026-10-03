package models

import (
	"context"

	"github.com/mubtadiaat/app/config"
)

// GenerateNilaiKhosBulk menghitung ulang Nilai Khos (nilai raport) untuk SEMUA
// santri aktif dalam satu bagian, sekaligus untuk kedua semester.
//
// Permintaan owner (2026-10-03): nilai raport harus langsung benar saat tabel
// penilaian dibuka. Selama ini hasil hitung hanya muncul setelah tombol
// "Simpan Semua Nilai" ditekan (generate per-santri dari saveAll), sehingga
// tabel raport terlihat kosong/basi sebelum Simpan.
//
// Aturan:
//   - Idempoten: sumber kebenaran TETAP nilai_kuartal + koreksi absensi —
//     sama persis dgn tombol Simpan, tidak ada jalur hitung kedua.
//   - Semester berstatus TERKUNCI dilewati — nilai final tidak diutak-atik.
//   - Satu santri gagal tidak menggugurkan santri lain; error pertama
//     dikembalikan BERSAMA jumlah yang berhasil diproses (partial success).
func GenerateNilaiKhosBulk(ctx context.Context, bagianID int, tahunAjaran string) (int, error) {
	rows, err := config.DB.Query(ctx,
		`SELECT id FROM santri WHERE bagian_id = $1 AND status = 'aktif' ORDER BY nama ASC`,
		bagianID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var santriIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return 0, err
		}
		santriIDs = append(santriIDs, id)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	// Cek kunci per semester (TIDAK ada baris = DRAFT = tidak terkunci).
	locked := map[int]bool{}
	for _, sem := range []int{1, 2} {
		if lk, lkErr := IsSemesterLocked(ctx, tahunAjaran, sem); lkErr == nil && lk {
			locked[sem] = true
		}
	}

	processed := 0
	var firstErr error
	for _, sid := range santriIDs {
		for _, sem := range []int{1, 2} {
			if locked[sem] {
				continue
			}
			if genErr := GenerateNilaiKhos(ctx, sid, sem, tahunAjaran); genErr != nil {
				if firstErr == nil {
					firstErr = genErr
				}
				continue
			}
			processed++
		}
	}
	return processed, firstErr
}
