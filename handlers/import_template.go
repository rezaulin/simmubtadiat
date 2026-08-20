package handlers

import (
	"net/http"

	"github.com/xuri/excelize/v2"
)

// DownloadTemplateAlumni mengembalikan file Excel (.xlsx) template import alumni.
// Format: NAMA | Stambuk | NISN | TTL | WALI | ALAMAT | NO HP WS | KHIDMAH | TEMPAT KHIDMAH | PENGAMBILAN IJAZAH | KETERANGAN | TAHUN MASUK | TAHUN KELUAR
func DownloadTemplateAlumni(w http.ResponseWriter, r *http.Request) {
	f := excelize.NewFile()
	defer f.Close()
	sheet := "Data Alumni"
	f.SetSheetName("Sheet1", sheet)

	headers := []string{
		"Nama", "Stambuk", "NISN", "TTL", "Wali", "Alamat", "No HP WS",
		"Khidmah", "Tempat Khidmah", "Pengambilan Ijazah", "Keterangan",
		"Tahun Masuk", "Tahun Keluar", "Kamar",
	}

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
		"Fatimah", "4576", "0012345678", "Kediri, 21 Juli 2000", "Muhammad",
		"Mojoroto, Kediri, Jawa Timur", "085691985001",
		"Khidmah", "Ustadzah", "Sudah", "", "2020", "2025", "Kamar A1",
	}
	for i, v := range example {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		f.SetCellValue(sheet, cell, v)
	}

	// Sheet petunjuk
	const petunjuk = "Petunjuk"
	f.NewSheet(petunjuk)
	guide := []string{
		"Petunjuk Pengisian Data Alumni",
		"",
		"1. Jangan mengubah baris header (baris pertama).",
		"2. Hapus baris contoh sebelum mengunggah.",
		"3. Kolom wajib: Nama, Stambuk.",
		"4. Khidmah: isi 'Khidmah' atau 'Tidak Khidmah'.",
		"5. Pengambilan Ijazah: Sudah / Belum / Tidak.",
		"6. TTL format bebas (Kota, Tanggal).",
		"7. Jika Stambuk sudah ada di sistem, data akan di-update.",
	}
	for i, row := range guide {
		cell, _ := excelize.CoordinatesToCellName(1, i+1)
		f.SetCellValue(petunjuk, cell, row)
	}
	f.SetColWidth(petunjuk, "A", "A", 80)

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="template_import_alumni.xlsx"`)

	if err := f.Write(w); err != nil {
		http.Error(w, "Gagal membuat template: "+err.Error(), http.StatusInternalServerError)
	}
}
