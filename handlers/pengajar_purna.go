package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/models"
	"github.com/xuri/excelize/v2"
)

// pengajarPurnaFilterFromQuery membangun filter dari query string (dipakai list & export).
func pengajarPurnaFilterFromQuery(r *http.Request) models.PengajarPurnaFilter {
	return models.PengajarPurnaFilter{
		Status:        r.URL.Query().Get("status"),
		ProvinsiKode:  r.URL.Query().Get("provinsi"),
		KabupatenKode: r.URL.Query().Get("kabupaten"),
		TahunMasuk:    r.URL.Query().Get("tahun_masuk"),
		TahunKeluar:   r.URL.Query().Get("tahun_keluar"),
	}
}

// GetPengajarPurna: GET /api/pengajar-purna — daftar dengan filter.
func GetPengajarPurna(w http.ResponseWriter, r *http.Request) {
	res, err := models.GetAllPengajarPurna(r.Context(), pengajarPurnaFilterFromQuery(r))
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// CreatePengajarPurna: POST /api/pengajar-purna — tambah manual.
func CreatePengajarPurna(w http.ResponseWriter, r *http.Request) {
	var p models.PengajarPurna
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if p.Nama == "" {
		writeJSONError(w, "Nama wajib diisi", http.StatusBadRequest)
		return
	}
	if err := models.CreatePengajarPurna(r.Context(), p); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Pengajar purna berhasil ditambahkan"})
}

// UpdatePengajarPurna: PUT /api/pengajar-purna/{id}.
func UpdatePengajarPurna(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSONError(w, "ID tidak valid", http.StatusBadRequest)
		return
	}
	var p models.PengajarPurna
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if p.Nama == "" {
		writeJSONError(w, "Nama wajib diisi", http.StatusBadRequest)
		return
	}
	if err := models.UpdatePengajarPurna(r.Context(), id, p); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Pengajar purna berhasil diperbarui"})
}

// DeletePengajarPurna: DELETE /api/pengajar-purna/{id} — soft delete.
func DeletePengajarPurna(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSONError(w, "ID tidak valid", http.StatusBadRequest)
		return
	}
	if err := models.DeletePengajarPurna(r.Context(), id); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Pengajar purna berhasil dihapus"})
}

// ImportPengajarPurna: POST /api/pengajar-purna/import — impor massal dari Excel.
func ImportPengajarPurna(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10MB
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeJSONError(w, "Gagal membaca file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	result, err := models.ImportPengajarPurnaFromExcel(r.Context(), file)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ExportPengajarPurna: GET /api/pengajar-purna/export — unduh data (menghormati filter).
func ExportPengajarPurna(w http.ResponseWriter, r *http.Request) {
	data, err := models.GetAllPengajarPurna(r.Context(), pengajarPurnaFilterFromQuery(r))
	if err != nil {
		http.Error(w, "Gagal mengambil data: "+err.Error(), http.StatusInternalServerError)
		return
	}

	f := excelize.NewFile()
	defer f.Close()
	sheet := "Sheet1"

	headers := []string{"Nama Lengkap", "Status", "Tempat, Tanggal Lahir", "Nama Wali", "Nomor HP", "Alamat", "Provinsi", "Kabupaten", "Tahun Mengajar", "Tahun Keluar"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	deref := func(s *string) string {
		if s != nil {
			return *s
		}
		return ""
	}

	for i, p := range data {
		row := i + 2
		f.SetCellValue(sheet, cellName(1, row), p.Nama)
		f.SetCellValue(sheet, cellName(2, row), deref(p.Status))
		f.SetCellValue(sheet, cellName(3, row), deref(p.TTL))
		f.SetCellValue(sheet, cellName(4, row), deref(p.NamaWali))
		f.SetCellValue(sheet, cellName(5, row), deref(p.NoHP))
		f.SetCellValue(sheet, cellName(6, row), deref(p.Alamat))
		f.SetCellValue(sheet, cellName(7, row), deref(p.ProvinsiNama))
		f.SetCellValue(sheet, cellName(8, row), deref(p.KabupatenNama))
		f.SetCellValue(sheet, cellName(9, row), deref(p.TahunMengajar))
		f.SetCellValue(sheet, cellName(10, row), deref(p.TahunKeluar))
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename=Data_Pengajar_Purna.xlsx")
	if err := f.Write(w); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// DownloadTemplatePengajarPurna: GET /api/pengajar-purna/template.
func DownloadTemplatePengajarPurna(w http.ResponseWriter, r *http.Request) {
	f := excelize.NewFile()
	defer f.Close()
	sheet := "Data Pengajar Purna"
	f.SetSheetName("Sheet1", sheet)

	headers := []string{"Nama", "Status", "TTL", "Nama Wali", "No HP", "Alamat", "Provinsi", "Kabupaten", "Tahun Mengajar", "Tahun Keluar"}

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

	example := []interface{}{
		"Ahmad Fauzi", "mustahiq", "Kediri, 12 Mei 1985", "H. Sulaiman", "081234567890",
		"Mojoroto, Kediri", "Jawa Timur", "Kediri", "2010", "2020",
	}
	for i, v := range example {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		f.SetCellValue(sheet, cell, v)
	}

	const petunjuk = "Petunjuk"
	f.NewSheet(petunjuk)
	guide := []string{
		"Petunjuk Pengisian Data Pengajar Purna",
		"",
		"1. Jangan mengubah baris header (baris pertama).",
		"2. Hapus baris contoh sebelum mengunggah.",
		"3. Kolom wajib: Nama.",
		"4. Status: isi 'mustahiq' atau 'munawwib'.",
		"5. Provinsi & Kabupaten: tulis nama sesuai daftar wilayah (mis. 'Jawa Timur', 'Kediri').",
		"   Jika nama tidak cocok dengan data wilayah, kolom wilayah dikosongkan otomatis.",
		"6. TTL format bebas (Kota, Tanggal).",
		"7. Tahun Mengajar = tahun mulai mengajar; Tahun Keluar = tahun berhenti.",
	}
	for i, row := range guide {
		cell, _ := excelize.CoordinatesToCellName(1, i+1)
		f.SetCellValue(petunjuk, cell, row)
	}
	f.SetColWidth(petunjuk, "A", "A", 80)

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="template_import_pengajar_purna.xlsx"`)
	if err := f.Write(w); err != nil {
		http.Error(w, "Gagal membuat template: "+err.Error(), http.StatusInternalServerError)
	}
}

// PindahPengajarPurna: POST /api/pengajar/{id}/pindah-purna — pindahkan pengajar
// aktif ke arsip purna (single) atau POST /api/pengajar/pindah-purna dengan body
// {ids: [...]} untuk bulk. Status purna auto-copy dari status terakhir pengajar.
func PindahPengajarPurna(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs            []int  `json:"ids"`             // bulk: daftar ID pengajar
		TahunKeluar    string `json:"tahun_keluar"`
		ProvinsiKode   string `json:"provinsi_kode"`
		ProvinsiNama   string `json:"provinsi_nama"`
		KabupatenKode  string `json:"kabupaten_kode"`
		KabupatenNama  string `json:"kabupaten_nama"`
	}

	// Single: ID dari URL param; bulk: dari body.
	if idParam := chi.URLParam(r, "id"); idParam != "" {
		id, err := strconv.Atoi(idParam)
		if err != nil {
			writeJSONError(w, "ID tidak valid", http.StatusBadRequest)
			return
		}
		req.IDs = []int{id}
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && r.ContentLength > 0 {
		writeJSONError(w, "Body tidak valid", http.StatusBadRequest)
		return
	}
	if len(req.IDs) == 0 {
		writeJSONError(w, "Tidak ada pengajar yang dipilih", http.StatusBadRequest)
		return
	}

	res, err := models.PindahPengajarKePurna(r.Context(), req.IDs,
		req.TahunKeluar, req.ProvinsiKode, req.ProvinsiNama, req.KabupatenKode, req.KabupatenNama)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": fmt.Sprintf("%d pengajar dipindah ke purna, %d dilewati", res.Moved, res.Skipped),
		"result":  res,
	})
}
