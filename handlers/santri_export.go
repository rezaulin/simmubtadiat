package handlers

import (
	"net/http"

	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
	"github.com/xuri/excelize/v2"
)

func ExportSantri(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	filter := models.SantriFilter{
		ProvinsiKode:  r.URL.Query().Get("provinsi"),
		KabupatenKode: r.URL.Query().Get("kabupaten"),
	}
	
	// Admin asked for "data santri dan pengajar aktif"
	data, err := models.GetSantriAktif(r.Context(), user.Roles, user.ID, filter)
	if err != nil {
		http.Error(w, "Gagal mengambil data: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Create Excel file
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			// Do nothing
		}
	}()
	sheet := "Sheet1"

	// Headers
	headers := []string{"Stambuk", "Nama Lengkap", "Kamar", "Ruang/Bagian", "Kelas", "Tingkatan", "Provinsi", "Kabupaten", "Status"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, header)
	}

	// Rows
	for i, s := range data {
		row := i + 2
		if s.Stambuk != nil { f.SetCellValue(sheet, cellName(1, row), *s.Stambuk) }
		f.SetCellValue(sheet, cellName(2, row), s.Nama)
		if s.Kamar != nil { f.SetCellValue(sheet, cellName(3, row), *s.Kamar) }
		if s.BagianNama != nil { f.SetCellValue(sheet, cellName(4, row), *s.BagianNama) }
		if s.KelasNama != nil { f.SetCellValue(sheet, cellName(5, row), *s.KelasNama) }
		if s.TingkatanNama != nil { f.SetCellValue(sheet, cellName(6, row), *s.TingkatanNama) }
		if s.ProvinsiNama != nil { f.SetCellValue(sheet, cellName(7, row), *s.ProvinsiNama) }
		if s.KabupatenNama != nil { f.SetCellValue(sheet, cellName(8, row), *s.KabupatenNama) }
		f.SetCellValue(sheet, cellName(9, row), s.Status)
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename=\"data_santri_aktif.xlsx\"")
	if err := f.Write(w); err != nil {
		http.Error(w, "Gagal menulis file Excel", http.StatusInternalServerError)
	}
}
