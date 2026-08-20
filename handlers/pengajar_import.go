package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mubtadiaat/app/models"
	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/xuri/excelize/v2"
)

func ExportPengajar(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// 1. Fetch data
	data, err := models.GetAllPengajar(r.Context(), user.Roles, user.PengajarID, 0, 0, 0)
	if err != nil {
		http.Error(w, "Gagal mengambil data: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Create Excel file
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			// Do nothing
		}
	}()
	sheet := "Sheet1"

	// Headers
	headers := []string{"Nama Lengkap", "Nama (Arab)", "Jenis Pengajar", "Nomor HP", "Alamat", "Tempat, Tanggal Lahir", "Nama Wali", "Tahun Mengajar"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, header)
	}

	// Rows
	for i, p := range data {
		row := i + 2
		f.SetCellValue(sheet, cellName(1, row), p.Nama)
		
		if p.NamaArab != nil {
			f.SetCellValue(sheet, cellName(2, row), *p.NamaArab)
		}
		if p.Status != nil {
			f.SetCellValue(sheet, cellName(3, row), *p.Status)
		}
		if p.NoHP != nil {
			f.SetCellValue(sheet, cellName(4, row), *p.NoHP)
		}
		if p.Alamat != nil {
			f.SetCellValue(sheet, cellName(5, row), *p.Alamat)
		}
		if p.TTL != nil {
			f.SetCellValue(sheet, cellName(6, row), *p.TTL)
		}
		if p.NamaWali != nil {
			f.SetCellValue(sheet, cellName(7, row), *p.NamaWali)
		}
		if p.TahunMengajar != nil {
			f.SetCellValue(sheet, cellName(8, row), *p.TahunMengajar)
		}
	}

	// Response
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename=Data_Pengajar.xlsx")
	if err := f.Write(w); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func cellName(col, row int) string {
	name, _ := excelize.CoordinatesToCellName(col, row)
	return name
}

func ImportPengajar(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 << 20) // 10MB
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Gagal membaca file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		http.Error(w, "File excel tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer f.Close()

	rows, err := f.GetRows("Sheet1")
	if err != nil {
		http.Error(w, "Gagal membaca Sheet1: "+err.Error(), http.StatusBadRequest)
		return
	}

	count := 0
	for i, row := range rows {
		if i == 0 {
			continue // Skip header
		}
		if len(row) == 0 || row[0] == "" {
			continue // Skip empty row
		}

		nama := row[0]
		
		var namaArab, noHp, alamat, ttl, namaWali, tahunMengajar, status *string

		if len(row) > 1 && row[1] != "" {
			namaArab = &row[1]
		}
		if len(row) > 2 && row[2] != "" {
			status = &row[2]
		}
		if len(row) > 3 && row[3] != "" {
			noHp = &row[3]
		}
		if len(row) > 4 && row[4] != "" {
			alamat = &row[4]
		}
		if len(row) > 5 && row[5] != "" {
			ttl = &row[5]
		}
		if len(row) > 6 && row[6] != "" {
			namaWali = &row[6]
		}
		if len(row) > 7 && row[7] != "" {
			tahunMengajar = &row[7]
		}

		p := models.Pengajar{
			Nama:          nama,
			NamaArab:      namaArab,
			NoHP:          noHp,
			Alamat:        alamat,
			TTL:           ttl,
			NamaWali:      namaWali,
			TahunMengajar: tahunMengajar,
			Status:        status,
		}

		if err := models.CreatePengajar(r.Context(), p); err != nil {
			http.Error(w, "Gagal menyimpan baris ke-"+strconv.Itoa(i+1)+": "+err.Error(), http.StatusInternalServerError)
			return
		}
		count++
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Berhasil mengimpor " + strconv.Itoa(count) + " pengajar",
	})
}
