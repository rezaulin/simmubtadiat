package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/mubtadiaat/app/config"
	"github.com/mubtadiaat/app/models"
	"github.com/xuri/excelize/v2"
)

// templateHeadersDewan adalah urutan kolom pada template impor dewan harian.
var templateHeadersDewan = []string{
	"Nama",         // wajib
	"Nama Wali",    // opsional
	"Alamat",       // opsional
	"No HP",        // opsional
	"Jabatan",      // wajib
	"Lembaga",      // wajib (P3HM / MPHM / M3PHM)
	"Tahun Aktif",  // wajib (format: 2025/2026)
}

// DownloadTemplateDewan menghasilkan file .xlsx template impor dewan harian.
func DownloadTemplateDewan(w http.ResponseWriter, r *http.Request) {
	f := excelize.NewFile()
	defer f.Close()

	const sheet = "Dewan Harian"
	f.SetSheetName("Sheet1", sheet)

	for i, h := range templateHeadersDewan {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	styleID, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"0E7C86"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	if err == nil {
		lastCol, _ := excelize.CoordinatesToCellName(len(templateHeadersDewan), 1)
		f.SetCellStyle(sheet, "A1", lastCol, styleID)
	}

	for i := range templateHeadersDewan {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheet, col, col, 22)
	}

	// Contoh baris
	contoh := []interface{}{
		"Lulu Izzatul Fikriyah", "Cardi", "Kayupuring, Petungkriyono, Pekalongan",
		"085691985001", "Sekretaris Umum", "P3HM", "2026/2027",
	}
	for i, v := range contoh {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		f.SetCellValue(sheet, cell, v)
	}

	// Sheet petunjuk
	const petunjuk = "Petunjuk"
	f.NewSheet(petunjuk)
	guide := [][]interface{}{
		{"Petunjuk Pengisian Dewan Harian"},
		{""},
		{"1. Jangan mengubah baris header (baris pertama)."},
		{"2. Hapus baris contoh sebelum mengunggah."},
		{"3. Kolom wajib: Nama, Jabatan, Lembaga, Tahun Aktif."},
		{"4. Lembaga harus salah satu dari: P3HM, MPHM, M3PHM."},
		{"5. Tahun Aktif format: 2025/2026."},
		{"6. Satu orang boleh muncul berkali-kali (jabatan berbeda tiap tahun = riwayat)."},
		{"7. Jika ada baris yang gagal, seluruh impor dibatalkan."},
	}
	for i, row := range guide {
		cell, _ := excelize.CoordinatesToCellName(1, i+1)
		f.SetCellValue(petunjuk, cell, row[0])
	}
	f.SetColWidth(petunjuk, "A", "A", 80)

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="template_import_dewan_harian.xlsx"`)
	if err := f.Write(w); err != nil {
		writeJSONError(w, "gagal membuat template", http.StatusInternalServerError)
	}
}

// ImportDewanHarian menerima file .xlsx dan batch insert ke tabel dewan_harian.
func ImportDewanHarian(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeJSONError(w, "file terlalu besar atau tidak valid", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		writeJSONError(w, "file tidak ditemukan", http.StatusBadRequest)
		return
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		writeJSONError(w, "gagal membaca file Excel", http.StatusBadRequest)
		return
	}
	defer f.Close()

	sheet := f.GetSheetName(0)
	if sheet == "" {
		writeJSONError(w, "file Excel kosong", http.StatusBadRequest)
		return
	}

	rows, err := f.GetRows(sheet)
	if err != nil {
		writeJSONError(w, "gagal membaca data", http.StatusBadRequest)
		return
	}
	if len(rows) < 2 {
		writeJSONError(w, "tidak ada data untuk diimpor", http.StatusBadRequest)
		return
	}

	validLembaga := map[string]bool{"P3HM": true, "MPHM": true, "M3PHM": true}

	type importError struct {
		Baris int    `json:"baris"`
		Nama  string `json:"nama"`
		Pesan string `json:"pesan"`
	}
	var errors []importError
	var entries []models.DewanHarian

	for idx := 1; idx < len(rows); idx++ {
		row := rows[idx]
		baris := idx + 1

		get := func(i int) string {
			if i < len(row) {
				return strings.TrimSpace(row[i])
			}
			return ""
		}

		nama := get(0)
		jabatan := get(4)
		lembaga := strings.ToUpper(get(5))
		tahunAktif := get(6)

		// Skip empty rows
		if nama == "" && jabatan == "" {
			continue
		}

		if nama == "" || jabatan == "" || lembaga == "" || tahunAktif == "" {
			errors = append(errors, importError{Baris: baris, Nama: nama, Pesan: "Nama, Jabatan, Lembaga, dan Tahun Aktif wajib diisi"})
			continue
		}

		if !validLembaga[lembaga] {
			errors = append(errors, importError{Baris: baris, Nama: nama, Pesan: fmt.Sprintf("Lembaga '%s' tidak valid (harus P3HM/MPHM/M3PHM)", get(5))})
			continue
		}

		namaWali := optStrDewan(get(1))
		alamat := optStrDewan(get(2))
		noHp := optStrDewan(get(3))

		entries = append(entries, models.DewanHarian{
			Nama:       nama,
			NamaWali:   namaWali,
			Alamat:     alamat,
			NoHP:       noHp,
			Jabatan:    jabatan,
			Lembaga:    lembaga,
			TahunAktif: tahunAktif,
			IsActive:   true,
		})
	}

	if len(errors) > 0 {
		w.WriteHeader(http.StatusUnprocessableEntity)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"sukses": 0,
			"gagal":  len(errors),
			"errors": errors,
		})
		return
	}

	if len(entries) == 0 {
		writeJSONError(w, "tidak ada data untuk diimpor", http.StatusBadRequest)
		return
	}

	// Batch insert dalam satu transaksi
	tx, err := config.DB.Begin(r.Context())
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	for _, dh := range entries {
		_, err := tx.Exec(r.Context(),
			`INSERT INTO dewan_harian (nama, nama_wali, no_hp, alamat, jabatan, lembaga, tahun_aktif, is_active)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
			dh.Nama, dh.NamaWali, dh.NoHP, dh.Alamat, dh.Jabatan, dh.Lembaga, dh.TahunAktif)
		if err != nil {
			writeJSONError(w, fmt.Sprintf("Gagal insert '%s': %v", dh.Nama, err), http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": fmt.Sprintf("%d data dewan harian berhasil diimpor", len(entries)),
		"sukses":  len(entries),
	})
}

func optStrDewan(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
