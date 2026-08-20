package models

import (
	"context"

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

// FindKabupatenByNama mencari kabupaten berdasarkan nama (case-insensitive) untuk impor Excel.
func FindKabupatenByNama(ctx context.Context, provinsiKode, nama string) (Wilayah, error) {
	var w Wilayah
	err := config.DB.QueryRow(ctx,
		`SELECT kode, nama FROM wil_kabupaten WHERE provinsi_kode = $1 AND LOWER(nama) = LOWER($2) LIMIT 1`,
		provinsiKode, nama).Scan(&w.Kode, &w.Nama)
	return w, err
}

// FindProvinsiByNama mencari provinsi berdasarkan nama (case-insensitive) untuk impor Excel.
func FindProvinsiByNama(ctx context.Context, nama string) (Wilayah, error) {
	var w Wilayah
	err := config.DB.QueryRow(ctx,
		`SELECT kode, nama FROM wil_provinsi WHERE LOWER(nama) = LOWER($1) LIMIT 1`, nama).Scan(&w.Kode, &w.Nama)
	return w, err
}

// FindKecamatanByNama mencari kecamatan berdasarkan nama (case-insensitive) untuk impor Excel.
func FindKecamatanByNama(ctx context.Context, kabupatenKode, nama string) (Wilayah, error) {
	var w Wilayah
	err := config.DB.QueryRow(ctx,
		`SELECT kode, nama FROM wil_kecamatan WHERE kabupaten_kode = $1 AND LOWER(nama) = LOWER($2) LIMIT 1`,
		kabupatenKode, nama).Scan(&w.Kode, &w.Nama)
	return w, err
}
