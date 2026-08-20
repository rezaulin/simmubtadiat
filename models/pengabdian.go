package models

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/mubtadiaat/app/config"
)

// Format tanggal yang dipakai untuk input khidmah ("YYYY-MM-DD").
const tanggalKhidmahLayout = "2006-01-02"

// MulaiPengabdianInput adalah payload untuk memulai pengabdian (aktif → pengabdian).
type MulaiPengabdianInput struct {
	SantriID      int    `json:"santri_id"`
	KhidmahTempat string `json:"khidmah_tempat"`
	KhidmahMulai  string `json:"khidmah_mulai"` // "YYYY-MM-DD"
}

// SelesaiPengabdianInput adalah payload untuk menyelesaikan pengabdian (pengabdian → lulus).
type SelesaiPengabdianInput struct {
	SantriID       int    `json:"santri_id"`
	KhidmahSelesai string `json:"khidmah_selesai"` // "YYYY-MM-DD"
}

// PengabdianItem adalah elemen daftar santri berstatus pengabdian.
type PengabdianItem struct {
	SantriID      int     `json:"santri_id"`
	Nama          string  `json:"nama"`
	Stambuk       string  `json:"stambuk"`
	KhidmahTempat *string `json:"khidmah_tempat"`
	KhidmahMulai  *string `json:"khidmah_mulai"`
}

// ValidateMulaiPengabdian memvalidasi input Mulai_Pengabdian tanpa menyentuh DB.
// Aturan: khidmah_tempat wajib non-kosong (setelah trim); khidmah_mulai wajib
// non-kosong dan berformat tanggal "2006-01-02" yang valid.
func ValidateMulaiPengabdian(in MulaiPengabdianInput) error {
	if strings.TrimSpace(in.KhidmahTempat) == "" {
		return errors.New("Tempat khidmah wajib diisi")
	}
	if strings.TrimSpace(in.KhidmahMulai) == "" {
		return errors.New("Tanggal mulai khidmah wajib diisi")
	}
	if _, err := time.Parse(tanggalKhidmahLayout, strings.TrimSpace(in.KhidmahMulai)); err != nil {
		return errors.New("Tanggal mulai khidmah tidak valid")
	}
	return nil
}

// ValidateSelesaiPengabdian memvalidasi input Lepas_Pengabdian tanpa menyentuh DB.
// Aturan: khidmah_selesai wajib non-kosong dan berformat tanggal "2006-01-02"
// yang valid.
func ValidateSelesaiPengabdian(in SelesaiPengabdianInput) error {
	if strings.TrimSpace(in.KhidmahSelesai) == "" {
		return errors.New("Tanggal selesai khidmah wajib diisi")
	}
	if _, err := time.Parse(tanggalKhidmahLayout, strings.TrimSpace(in.KhidmahSelesai)); err != nil {
		return errors.New("Tanggal selesai khidmah tidak valid")
	}
	return nil
}

// Regex deteksi Kelas_Akhir (Kelas 3 Aliyah). Disamakan dengan logika frontend
// isKelasAkhirAliyah pada frontend/src/js/perpindahan.js agar backend & frontend
// sepakat.
var (
	reAliyah = regexp.MustCompile(`(?i)aliyah`)
	reKelas3 = regexp.MustCompile(`(^|\D)3(\D|$)`)
	reTiga   = regexp.MustCompile(`(?i)tiga`)
)

// IsKelasAkhir mengembalikan true bila kombinasi nama tingkatan & nama kelas
// menandakan "Kelas 3 Aliyah". Aturan: tingkatan cocok regex case-insensitive
// `aliyah` DAN kelas mengandung angka 3 sebagai token (`(^|\D)3(\D|$)`) atau
// kata `tiga` (case-insensitive).
func IsKelasAkhir(tingkatanNama, kelasNama string) bool {
	isAliyah := reAliyah.MatchString(tingkatanNama)
	isKelas3 := reKelas3.MatchString(kelasNama) || reTiga.MatchString(kelasNama)
	return isAliyah && isKelas3
}

// resolveStatusKeluar mengoersi status keluar berdasarkan penanda Kelas_Akhir.
// Bila status yang diminta adalah `boyong` dan santri berada di Kelas_Akhir,
// status dikoersi menjadi `lulus`. Pada semua kasus lain status dikembalikan
// apa adanya.
func resolveStatusKeluar(status string, isAkhir bool) string {
	if status == "boyong" && isAkhir {
		return "lulus"
	}
	return status
}

// GetKelasAkhirStatus mengambil tingkatan & kelas terakhir yang pernah/masih
// ditempati santri dari riwayat_bagian → bagian → (tingkatan, kelas), lalu
// mengembalikan hasil IsKelasAkhir. Dipakai oleh ProsesKeluarSantri untuk
// koersi boyong → lulus. Bila santri tidak punya riwayat, mengembalikan false.
func GetKelasAkhirStatus(ctx context.Context, tx pgx.Tx, santriID int) (bool, error) {
	var tingkatanNama, kelasNama *string
	err := tx.QueryRow(ctx,
		`SELECT t.nama, k.nama
		 FROM riwayat_bagian rb
		 JOIN bagian b ON rb.bagian_id = b.id
		 LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		 LEFT JOIN kelas k ON b.kelas_id = k.id
		 WHERE rb.santri_id = $1
		 ORDER BY rb.tanggal_mulai DESC NULLS LAST, rb.id DESC
		 LIMIT 1`, santriID).Scan(&tingkatanNama, &kelasNama)
	if err != nil {
		// Santri tanpa riwayat kelas dianggap belum Kelas_Akhir.
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	var t, k string
	if tingkatanNama != nil {
		t = *tingkatanNama
	}
	if kelasNama != nil {
		k = *kelasNama
	}
	return IsKelasAkhir(t, k), nil
}

// MulaiPengabdian menjalankan transisi status santri dari `aktif` menjadi
// `pengabdian` dalam satu transaksi (Requirement 2.1–2.5, 2.8):
//  1. Validasi input via ValidateMulaiPengabdian.
//  2. UPDATE santri → status `pengabdian`, bagian_id NULL, simpan khidmah;
//     hanya bila status awal `aktif` (dijaga lewat WHERE + RowsAffected).
//  3. Tutup baris riwayat_bagian yang masih terbuka.
//  4. Tidak menyentuh tabel alumni.
func MulaiPengabdian(ctx context.Context, in MulaiPengabdianInput) error {
	if err := ValidateMulaiPengabdian(in); err != nil {
		return err
	}

	tempat := strings.TrimSpace(in.KhidmahTempat)
	mulai := strings.TrimSpace(in.KhidmahMulai)

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Ubah status santri menjadi pengabdian, lepaskan dari bagian, simpan
	// data khidmah. Guard status awal `aktif` lewat WHERE + RowsAffected.
	tag, err := tx.Exec(ctx,
		`UPDATE santri
		 SET status = 'pengabdian', bagian_id = NULL,
		     khidmah_tempat = $1, khidmah_mulai = $2, updated_at = NOW()
		 WHERE id = $3 AND status = 'aktif'`, tempat, mulai, in.SantriID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("Santri tidak berstatus aktif")
	}

	// 2. Tutup riwayat kelas terakhir yang masih terbuka (Requirement 2.3).
	_, err = tx.Exec(ctx,
		`UPDATE riwayat_bagian
		 SET tanggal_selesai = $1
		 WHERE santri_id = $2 AND tanggal_selesai IS NULL`, mulai, in.SantriID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// SelesaiPengabdian menjalankan transisi status santri dari `pengabdian` menjadi
// `lulus` dalam satu transaksi (Requirement 3.1–3.4, 3.6, 3.7):
//  1. Validasi input via ValidateSelesaiPengabdian.
//  2. UPDATE santri → status `lulus`, isi khidmah_selesai; hanya bila status
//     awal `pengabdian` (dijaga lewat WHERE + RowsAffected), sekaligus ambil
//     khidmah_tempat lewat RETURNING untuk disalin ke alumni.
//  3. INSERT baris alumni dengan tahun_lulus tahun berjalan dan khidmah dari
//     khidmah_tempat santri; ON CONFLICT DO NOTHING agar idempoten.
func SelesaiPengabdian(ctx context.Context, in SelesaiPengabdianInput) error {
	if err := ValidateSelesaiPengabdian(in); err != nil {
		return err
	}

	selesai := strings.TrimSpace(in.KhidmahSelesai)

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Ubah status santri menjadi lulus, isi khidmah_selesai. Guard status
	// awal `pengabdian` lewat WHERE.
	tag, err := tx.Exec(ctx,
		`UPDATE santri
		 SET status = 'lulus', khidmah_selesai = $1, tahun_keluar = EXTRACT(YEAR FROM $1::DATE)::TEXT, updated_at = NOW()
		 WHERE id = $2 AND status = 'pengabdian'`, selesai, in.SantriID)
	if err != nil {
		return fmt.Errorf("gagal update santri: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errors.New("Santri tidak berstatus pengabdian")
	}

	// 2. Buat/update baris alumni. khidmah = 'selesai' (enum konsisten).
	// khidmah_tempat sudah tersimpan di tabel santri sejak MulaiPengabdian.
	tahunLulus := time.Now().Format("2006")
	_, err = tx.Exec(ctx,
		`INSERT INTO alumni (santri_id, tahun_lulus, khidmah)
		 VALUES ($1, $2, 'selesai')
		 ON CONFLICT (santri_id) DO UPDATE SET
		   khidmah = 'selesai',
		   tahun_lulus = COALESCE(alumni.tahun_lulus, EXCLUDED.tahun_lulus),
		   updated_at = CURRENT_TIMESTAMP`, in.SantriID, tahunLulus)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// GetSantriPengabdian mengembalikan daftar santri berstatus `pengabdian` untuk
// tab Pengabdian pada Halaman Alumni (Requirement 8.2). Tiap item memuat id,
// nama, stambuk, khidmah_tempat, dan khidmah_mulai (diformat "2006-01-02")
// diurutkan berdasarkan nama secara menaik.
func GetSantriPengabdian(ctx context.Context) ([]PengabdianItem, error) {
	rows, err := config.DB.Query(ctx,
		`SELECT s.id, s.nama, COALESCE(s.stambuk, '') AS stambuk, s.khidmah_tempat, s.khidmah_mulai
		 FROM santri s
		 WHERE s.status = 'pengabdian'
		 ORDER BY s.nama ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []PengabdianItem{}
	for rows.Next() {
		var item PengabdianItem
		var khidmahMulai *time.Time
		if err := rows.Scan(&item.SantriID, &item.Nama, &item.Stambuk,
			&item.KhidmahTempat, &khidmahMulai); err != nil {
			return nil, err
		}
		// Format tanggal DATE → *string "2006-01-02" agar sesuai bentuk JSON
		// PengabdianItem.
		if khidmahMulai != nil {
			s := khidmahMulai.Format(tanggalKhidmahLayout)
			item.KhidmahMulai = &s
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
