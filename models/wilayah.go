package models

import (
	"context"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/mubtadiaat/app/config"
)

// Wilayah adalah entri referensi wilayah (provinsi/kabupaten/kecamatan).
type Wilayah struct {
	Kode string `json:"kode"`
	Nama string `json:"nama"`
}

const wilayahLimit = 30

// SearchProvinsi mengembalikan daftar provinsi, difilter opsional oleh q (ketik).
func SearchProvinsi(ctx context.Context, q string) ([]Wilayah, error) {
	rows, err := config.DB.Query(ctx,
		`SELECT kode, nama FROM wil_provinsi
		 WHERE ($1 = '' OR nama ILIKE '%' || $1 || '%')
		 ORDER BY nama ASC LIMIT $2`, q, wilayahLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWilayah(rows)
}

// SearchKabupaten mengembalikan kabupaten pada suatu provinsi, difilter oleh q.
func SearchKabupaten(ctx context.Context, provinsiKode, q string) ([]Wilayah, error) {
	rows, err := config.DB.Query(ctx,
		`SELECT kode, nama FROM wil_kabupaten
		 WHERE provinsi_kode = $1 AND ($2 = '' OR nama ILIKE '%' || $2 || '%')
		 ORDER BY nama ASC LIMIT $3`, provinsiKode, q, wilayahLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWilayah(rows)
}

// SearchKecamatan mengembalikan kecamatan pada suatu kabupaten, difilter oleh q.
func SearchKecamatan(ctx context.Context, kabupatenKode, q string) ([]Wilayah, error) {
	rows, err := config.DB.Query(ctx,
		`SELECT kode, nama FROM wil_kecamatan
		 WHERE kabupaten_kode = $1 AND ($2 = '' OR nama ILIKE '%' || $2 || '%')
		 ORDER BY nama ASC LIMIT $3`, kabupatenKode, q, wilayahLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWilayah(rows)
}

func scanWilayah(rows interface {
	Next() bool
	Scan(...interface{}) error
}) ([]Wilayah, error) {
	result := []Wilayah{}
	for rows.Next() {
		var w Wilayah
		if err := rows.Scan(&w.Kode, &w.Nama); err != nil {
			return nil, err
		}
		result = append(result, w)
	}
	return result, nil
}

// LookupProvinsiNama mengembalikan nama provinsi dari kode, atau kosong jika tak ada.
func LookupProvinsiNama(ctx context.Context, kode string) (string, error) {
	return lookupNama(ctx, "wil_provinsi", kode)
}

// LookupKabupaten mengembalikan nama kabupaten dan kode provinsi induknya.
func LookupKabupaten(ctx context.Context, kode string) (nama, provinsiKode string, err error) {
	err = config.DB.QueryRow(ctx,
		`SELECT nama, provinsi_kode FROM wil_kabupaten WHERE kode = $1`, kode).Scan(&nama, &provinsiKode)
	return
}

// LookupKecamatan mengembalikan nama kecamatan dan kode kabupaten induknya.
func LookupKecamatan(ctx context.Context, kode string) (nama, kabupatenKode string, err error) {
	err = config.DB.QueryRow(ctx,
		`SELECT nama, kabupaten_kode FROM wil_kecamatan WHERE kode = $1`, kode).Scan(&nama, &kabupatenKode)
	return
}

func lookupNama(ctx context.Context, table, kode string) (string, error) {
	var nama string
	err := config.DB.QueryRow(ctx, `SELECT nama FROM `+table+` WHERE kode = $1`, kode).Scan(&nama)
	return nama, err
}

// normalizeWilayah membersihkan nama wilayah untuk pencocokan impor Excel:
// strip prefix administratif (KABUPATEN/KOTA/KAB./KEC./PROVINSI/dst),
// buang tanda baca titik, rapatkan spasi. Case-insensitive di sisi SQL.
func normalizeWilayahNama(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, ".", " ")
	for _, pfx := range []string{"kabupaten ", "kota administrasi ", "kota ", "kab ", "kecamatan ", "kec ", "provinsi ", "prov ", "kepulauan "} {
		if strings.HasPrefix(s, pfx) {
			s = strings.TrimSpace(s[len(pfx):])
		}
	}
	return strings.Join(strings.Fields(s), " ")
}

// FindKabupatenByNama mencari kabupaten berdasarkan nama (case-insensitive) untuk impor Excel.
// Toleran terhadap perbedaan prefix ("KABUPATEN X" vs "X") & kata tambahan
// ("Bangka Belitung" vs "Kepulauan Bangka Belitung") via pencocokan bertahap.
func FindKabupatenByNama(ctx context.Context, provinsiKode, nama string) (Wilayah, error) {
	return findWilayahFleksibel(ctx, "wil_kabupaten", "provinsi_kode", provinsiKode, nama)
}

// ResolveKabupatenKecamatan menyelesaikan ambiguitas KOTA vs KABUPATEN dengan
// nama sama (mis. "TEGAL" → KABUPATEN TEGAL & KOTA TEGAL). Bila kecNama diberikan,
// dipilih kandidat kabupaten/kota yang BENAR-BENAR memuat kecamatan tersebut.
// Kembalian: kabupaten terpilih + kecamatan (kec kosong bila kecNama == "").
func ResolveKabupatenKecamatan(ctx context.Context, provinsiKode, kabNama, kecNama string) (kab Wilayah, kec Wilayah, err error) {
	cands, err := findWilayahCandidates(ctx, "wil_kabupaten", "provinsi_kode", provinsiKode, kabNama)
	if err != nil {
		return Wilayah{}, Wilayah{}, err
	}
	if len(cands) == 0 {
		return Wilayah{}, Wilayah{}, pgx.ErrNoRows
	}
	if kecNama == "" {
		return cands[0], Wilayah{}, nil
	}
	// Coba tiap kandidat kabupaten; ambil yang punya kecamatannya.
	var lastErr error = pgx.ErrNoRows
	for _, c := range cands {
		k, e := findWilayahFleksibel(ctx, "wil_kecamatan", "kabupaten_kode", c.Kode, kecNama)
		if e == nil {
			return c, k, nil
		}
		lastErr = e
	}
	// Tidak ada kandidat yang cocok untuk kecamatan → laporkan pakai kandidat pertama.
	return cands[0], Wilayah{}, lastErr
}

// FindProvinsiByNama mencari provinsi berdasarkan nama (case-insensitive) untuk impor Excel.
func FindProvinsiByNama(ctx context.Context, nama string) (Wilayah, error) {
	return findWilayahFleksibel(ctx, "wil_provinsi", "", "", nama)
}

// FindKecamatanByNama mencari kecamatan berdasarkan nama (case-insensitive) untuk impor Excel.
func FindKecamatanByNama(ctx context.Context, kabupatenKode, nama string) (Wilayah, error) {
	return findWilayahFleksibel(ctx, "wil_kecamatan", "kabupaten_kode", kabupatenKode, nama)
}

// findWilayahCandidates mengembalikan SEMUA wilayah yang cocok (exact-norm atau
// contains dua arah) pada bentuk ternormalisasi, diurut dari nama terpendek
// (paling spesifik) agar pemilih di atasnya deterministik.
func findWilayahCandidates(ctx context.Context, table, parentCol, parentKode, nama string) ([]Wilayah, error) {
	q := `SELECT kode, nama FROM ` + table
	args := []interface{}{}
	if parentCol != "" {
		q += ` WHERE ` + parentCol + ` = $1`
		args = append(args, parentKode)
	}
	rows, err := config.DB.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	target := normalizeWilayahNama(nama)
	var exact []Wilayah
	var contains []Wilayah
	for rows.Next() {
		var c Wilayah
		if err := rows.Scan(&c.Kode, &c.Nama); err != nil {
			continue
		}
		cn := normalizeWilayahNama(c.Nama)
		if cn == target {
			exact = append(exact, c)
		} else if strings.Contains(cn, target) || strings.Contains(target, cn) {
			contains = append(contains, c)
		}
	}
	out := append(exact, contains...)
	sort.SliceStable(out, func(i, j int) bool {
		return len(normalizeWilayahNama(out[i].Nama)) < len(normalizeWilayahNama(out[j].Nama))
	})
	return out, nil
}

// findWilayahFleksibel mencari satu wilayah dengan strategi bertingkat:
//  1. exact (LOWER = LOWER)
//  2. normalisasi kedua sisi (strip prefix admin + titik) lalu bandingkan sama persis
//  3. contains dua arah pada bentuk ternormalisasi (mis. "bangka belitung" ⊂
//     "kepulauan bangka belitung"), diambil kandidat terpendek agar tak ambigu.
//
// parentCol kosong → tabel tanpa filter induk (provinsi).
func findWilayahFleksibel(ctx context.Context, table, parentCol, parentKode, nama string) (Wilayah, error) {
	cands, err := findWilayahCandidates(ctx, table, parentCol, parentKode, nama)
	if err != nil {
		return Wilayah{}, err
	}
	if len(cands) == 0 {
		return Wilayah{}, pgx.ErrNoRows
	}
	return cands[0], nil
}
