package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/mubtadiaat/app/models"
	"github.com/xuri/excelize/v2"
)

// MulaiPengabdian menangani POST /api/pengabdian/mulai: transisi santri
// aktif → pengabdian. Error validasi/status dari model diperlakukan sebagai
// 400 (Bad Request) sesuai tabel Error Handling design.
func MulaiPengabdian(w http.ResponseWriter, r *http.Request) {
	var req models.MulaiPengabdianInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.MulaiPengabdian(r.Context(), req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	writeJSON(w, map[string]string{"status": "success", "message": "Pengabdian berhasil dimulai"})
}

// SelesaiPengabdian menangani POST /api/pengabdian/selesai: transisi santri
// pengabdian → lulus. Error validasi/status dari model diperlakukan sebagai
// 400 (Bad Request) sesuai tabel Error Handling design.
func SelesaiPengabdian(w http.ResponseWriter, r *http.Request) {
	var req models.SelesaiPengabdianInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.SelesaiPengabdian(r.Context(), req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	writeJSON(w, map[string]string{"status": "success", "message": "Pengabdian berhasil diselesaikan"})
}

// GetPengabdian menangani GET /api/pengabdian: daftar santri berstatus
// pengabdian. Kegagalan DB dikembalikan sebagai 500 (Internal Server Error).
func GetPengabdian(w http.ResponseWriter, r *http.Request) {
	res, err := models.GetSantriPengabdian(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, res)
}

// ImportPengabdianExcel menangani POST /api/pengabdian/import: import pengabdian dari Excel.
// Format: Nama | Stambuk | Tempat Khidmah | Tanggal Mulai
func ImportPengabdianExcel(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Gagal membaca file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		http.Error(w, "Gagal membaca file Excel: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer f.Close()

	sheet := f.GetSheetName(0)
	if sheet == "" {
		http.Error(w, "Sheet tidak ditemukan", http.StatusBadRequest)
		return
	}

	rows, err := f.GetRows(sheet)
	if err != nil || len(rows) < 2 {
		http.Error(w, "File Excel kosong atau tidak valid", http.StatusBadRequest)
		return
	}

	type importResult struct {
		Total   int      `json:"total"`
		Success int      `json:"success"`
		Failed  int      `json:"failed"`
		Errors  []string `json:"errors"`
	}

	result := importResult{Total: len(rows) - 1}

	// Load all santri for name/stambuk resolution
	allSantri, err := models.GetSantriAktif(r.Context(), []string{"pimpinan"}, 0, models.SantriFilter{})
	if err != nil {
		http.Error(w, "Gagal memuat data santri: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Build lookup maps
	byName := make(map[string]models.Santri)
	byStambuk := make(map[string]models.Santri)
	for _, s := range allSantri {
		if s.Nama != "" {
			byName[strings.ToLower(s.Nama)] = s
		}
		if s.Stambuk != nil && *s.Stambuk != "" {
			byStambuk[*s.Stambuk] = s
		}
	}

	for i, row := range rows {
		if i == 0 { // skip header
			continue
		}
		if len(row) < 4 {
			result.Failed++
			result.Errors = append(result.Errors, baris(i+1)+": kolom kurang")
			continue
		}
		nama := strings.TrimSpace(row[0])
		stambuk := strings.TrimSpace(row[1])
		khidmahTempat := strings.TrimSpace(row[2])
		khidmahMulai := strings.TrimSpace(row[3])

		// Resolve santri
		var santri models.Santri
		var found bool
		if stambuk != "" {
			santri, found = byStambuk[stambuk]
		}
		if !found && nama != "" {
			santri, found = byName[strings.ToLower(nama)]
		}
		if !found {
			result.Failed++
			result.Errors = append(result.Errors, baris(i+1)+": santri '"+nama+"' tidak ditemukan")
			continue
		}

		// Validate status must be 'aktif'
		if santri.Status != "aktif" {
			result.Failed++
			result.Errors = append(result.Errors, baris(i+1)+": "+nama+" status '"+santri.Status+"' (bukan aktif)")
			continue
		}

		// Start pengabdian
		input := models.MulaiPengabdianInput{
			SantriID:      santri.ID,
			KhidmahTempat: khidmahTempat,
			KhidmahMulai:  khidmahMulai,
		}
		if err := models.MulaiPengabdian(r.Context(), input); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, baris(i+1)+": "+err.Error())
			continue
		}
		result.Success++
	}

	writeJSON(w, result)
}

// DownloadTemplatePengabdian mengembalikan file Excel template import pengabdian.
func DownloadTemplatePengabdian(w http.ResponseWriter, r *http.Request) {
	f := excelize.NewFile()
	defer f.Close()
	sheet := "Data Pengabdian"
	f.SetSheetName("Sheet1", sheet)

	headers := []string{"Nama", "Stambuk", "Tempat Khidmah", "Tanggal Mulai"}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"0E7C86"}},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheet, col, col, 20)
	}

	// Baris contoh
	example := []interface{}{
		"Fatimah", "4576", "Pondok Pesantren", "2025-01-15",
	}
	for i, v := range rangeExample(example) {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		f.SetCellValue(sheet, cell, v)
	}

	// Sheet petunjuk
	const petunjuk = "Petunjuk"
	f.NewSheet(petunjuk)
	guide := []string{
		"PETUNJUK IMPORT PENGABDIAN",
		"",
		"1. Isi data pada sheet 'Data Pengabdian'",
		"2. Kolom yang wajib diisi: Nama atau Stambuk (salah satu), Tempat Khidmah, Tanggal Mulai",
		"3. Format tanggal: YYYY-MM-DD (contoh: 2025-01-15)",
		"4. Santri harus berstatus AKTIF untuk bisa dimulai pengabdiannya",
		"5. Nama harus sesuai dengan data di sistem (tidak case-sensitive)",
		"6. Stambuk harus sesuai jika ada",
	}
	for i, line := range guide {
		cell, _ := excelize.CoordinatesToCellName(1, i+1)
		f.SetCellValue(petunjuk, cell, line)
		if i == 0 {
			bold, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 14}})
			f.SetCellStyle(petunjuk, cell, cell, bold)
		}
	}
	f.SetColWidth(petunjuk, "A", "A", 60)

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename=Template_Pengabdian.xlsx")
	_ = f.Write(w)
}

func baris(i int) string {
	return fmt.Sprintf("Baris %d", i)
}

func rangeExample(s []interface{}) []interface{} {
	return s
}
