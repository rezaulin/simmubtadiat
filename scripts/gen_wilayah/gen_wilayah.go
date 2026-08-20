// gen_wilayah.go
//
// Generator sekali-jalan untuk menghasilkan migration seed wilayah Indonesia
// (Kabupaten/Kota dan Kecamatan) dari dataset publik emsifa/api-wilayah-indonesia.
// Data provinsi sudah di-seed pada migration 013.
//
// Cara pakai (butuh koneksi internet):
//
//	go run ./scripts/gen_wilayah
//
// Hasil: menulis file migrations/014_seed_wilayah.sql
//
// Sumber data: https://github.com/emsifa/api-wilayah-indonesia (kode BPS).
package main

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

const (
	regenciesURL = "https://raw.githubusercontent.com/emsifa/api-wilayah-indonesia/master/data/regencies.csv"
	districtsURL = "https://raw.githubusercontent.com/emsifa/api-wilayah-indonesia/master/data/districts.csv"
	outPath      = "migrations/014_seed_wilayah.sql"
)

// sqlEscape menggandakan tanda kutip tunggal agar aman dalam literal SQL.
func sqlEscape(s string) string {
	return strings.ReplaceAll(strings.TrimSpace(s), "'", "''")
}

// fetchCSV mengunduh sebuah file CSV dan mengembalikan seluruh recordnya.
// Format emsifa: id,parent_id?,name (regencies: id,province_id,name;
// districts: id,regency_id,name). id memakai format berpisah titik, mis.
// "32.01" untuk kabupaten dan "32.01.01" untuk kecamatan.
func fetchCSV(url string) ([][]string, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d for %s", resp.StatusCode, url)
	}
	r := csv.NewReader(resp.Body)
	r.FieldsPerRecord = -1
	var records [][]string
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

// normKode menghapus titik dari kode BPS sehingga "32.01.01" menjadi "320101".
func normKode(s string) string {
	return strings.ReplaceAll(strings.TrimSpace(s), ".", "")
}

func main() {
	fmt.Println("Mengunduh data kabupaten/kota...")
	regencies, err := fetchCSV(regenciesURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "gagal mengunduh regencies: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Mengunduh data kecamatan...")
	districts, err := fetchCSV(districtsURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "gagal mengunduh districts: %v\n", err)
		os.Exit(1)
	}

	f, err := os.Create(outPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "gagal membuat %s: %v\n", outPath, err)
		os.Exit(1)
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	defer w.Flush()

	fmt.Fprintln(w, "-- 014_seed_wilayah.sql")
	fmt.Fprintln(w, "-- Digenerate otomatis oleh scripts/gen_wilayah.")
	fmt.Fprintln(w, "-- Sumber: emsifa/api-wilayah-indonesia (kode BPS).")
	fmt.Fprintln(w, "-- Berisi seed Kabupaten/Kota dan Kecamatan.")
	fmt.Fprintln(w)

	// Kabupaten/Kota
	fmt.Fprintln(w, "INSERT INTO wil_kabupaten (kode, provinsi_kode, nama) VALUES")
	writeBatch(w, regencies, func(rec []string) (string, bool) {
		if len(rec) < 3 {
			return "", false
		}
		kode := normKode(rec[0])
		prov := normKode(rec[1])
		nama := sqlEscape(rec[2])
		if kode == "" || prov == "" || nama == "" {
			return "", false
		}
		return fmt.Sprintf("('%s', '%s', '%s')", kode, prov, nama), true
	}, "ON CONFLICT (kode) DO NOTHING;")

	fmt.Fprintln(w)

	// Kecamatan
	fmt.Fprintln(w, "INSERT INTO wil_kecamatan (kode, kabupaten_kode, nama) VALUES")
	writeBatch(w, districts, func(rec []string) (string, bool) {
		if len(rec) < 3 {
			return "", false
		}
		kode := normKode(rec[0])
		kab := normKode(rec[1])
		nama := sqlEscape(rec[2])
		if kode == "" || kab == "" || nama == "" {
			return "", false
		}
		return fmt.Sprintf("('%s', '%s', '%s')", kode, kab, nama), true
	}, "ON CONFLICT (kode) DO NOTHING;")

	fmt.Printf("Selesai. Ditulis ke %s (%d kabupaten, %d kecamatan)\n", outPath, len(regencies), len(districts))
}

// writeBatch menulis nilai VALUES dipisah koma, ditutup dengan tail (mis. ON CONFLICT).
func writeBatch(w *bufio.Writer, records [][]string, fn func([]string) (string, bool), tail string) {
	first := true
	for _, rec := range records {
		val, ok := fn(rec)
		if !ok {
			continue
		}
		if !first {
			fmt.Fprintln(w, ",")
		}
		fmt.Fprint(w, "    "+val)
		first = false
	}
	fmt.Fprintln(w)
	fmt.Fprintln(w, tail)
}
