package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mubtadiaat/app/models"
	"github.com/xuri/excelize/v2"
)

// templateHeaders adalah urutan kolom pada template impor santri.
var templateHeaders = []string{
	"NIK",             // wajib
	"Stambuk",         // opsional
	"NISN",            // opsional
	"Nama",            // wajib
	"Nama Wali",       // opsional
	"Tempat, Tanggal Lahir", // opsional (Misal: Surabaya, 12-10-2005)
	"No HP Wali",      // opsional
	"Provinsi",        // opsional (nama), harus sesuai referensi
	"Kabupaten/Kota",  // opsional (nama), harus di dalam provinsi
	"Kecamatan",       // opsional (nama), harus di dalam kabupaten
	"Desa/Kelurahan",  // opsional (teks bebas)
	"Alamat Tambahan", // opsional (jalan/RT/RW/dusun)
	"Kamar",           // opsional (nama/nomor kamar asrama)
}

// DownloadTemplateSantri menghasilkan file .xlsx template impor santri.
func DownloadTemplateSantri(w http.ResponseWriter, r *http.Request) {
	f := excelize.NewFile()
	defer f.Close()

	const sheet = "Data Santri"
	f.SetSheetName("Sheet1", sheet)

	// Header
	for i, h := range templateHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	// Style header: bold + background
	styleID, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"2F5496"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	if err == nil {
		lastCol, _ := excelize.CoordinatesToCellName(len(templateHeaders), 1)
		f.SetCellStyle(sheet, "A1", lastCol, styleID)
	}

	// Lebarkan kolom agar terbaca
	for i := range templateHeaders {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheet, col, col, 20)
	}

	// Baris contoh
	contoh := []interface{}{
		"3201234567890001", "5747", "0123456789", "Ahmad Fulan", "Bapak Fulan",
		"Bogor, 2010-05-17", "081234567890", "Jawa Barat", "Kabupaten Bogor",
		"Cibinong", "Pakansari", "Jl. Mawar No. 10 RT 01 RW 02", "Kamar A1",
	}
	for i, v := range contoh {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		f.SetCellValue(sheet, cell, v)
	}

	// Sheet petunjuk
	const petunjuk = "Petunjuk"
	f.NewSheet(petunjuk)
	guide := [][]interface{}{
		{"Petunjuk Pengisian"},
		{""},
		{"1. Jangan mengubah baris header (baris pertama)."},
		{"2. Hapus baris contoh sebelum mengunggah."},
		{"3. Kolom wajib: NIK, Nama."},
		{"4. Tempat, Tanggal Lahir dipisah koma (Misal: Surabaya, 12-10-2005 atau Bogor, 2010-05-17)."},
		{"5. Provinsi, Kabupaten/Kota, dan Kecamatan harus ditulis sesuai nama resmi."},
		{"   Kabupaten harus berada di dalam Provinsi yang ditulis, begitu pula Kecamatan."},
		{"6. Desa/Kelurahan dan Alamat Tambahan boleh diisi bebas."},
		{"7. Jika satu baris gagal, seluruh impor dibatalkan. Perbaiki lalu unggah ulang."},
	}
	for i, row := range guide {
		cell, _ := excelize.CoordinatesToCellName(1, i+1)
		f.SetCellValue(petunjuk, cell, row[0])
	}
	f.SetColWidth(petunjuk, "A", "A", 90)

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="template_import_santri.xlsx"`)
	if err := f.Write(w); err != nil {
		writeJSONError(w, "gagal membuat template", http.StatusInternalServerError)
		return
	}
}

// ImportSantri menerima file .xlsx, memvalidasi tiap baris, lalu memasukkan
// santri secara batch (transaksional). Baris yang gagal dilaporkan kembali.
func ImportSantri(w http.ResponseWriter, r *http.Request) {
	// Batasi ukuran upload 10 MB
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

	ctx := r.Context()
	var list []models.Santri
	var rowNumbers []int
	var parseErrors []models.ImportRowError

	// Lewati baris header (index 0)
	for idx := 1; idx < len(rows); idx++ {
		row := rows[idx]
		baris := idx + 1

		if isEmptyRow(row) {
			continue
		}

		get := func(i int) string {
			if i < len(row) {
				return strings.TrimSpace(row[i])
			}
			return ""
		}

		nik := get(0)
		nama := get(3)

		if nik == "" || nama == "" {
			parseErrors = append(parseErrors, models.ImportRowError{
				Baris: baris, Nama: nama, Pesan: "NIK dan Nama wajib diisi",
			})
			continue
		}

		s := models.Santri{
			NIK:          nik,
			Nama:         nama,
		}
		s.Stambuk = optStr(get(1))
		s.NISN = optStr(get(2))
		s.NamaWali = optStr(get(4))
		
		ttlInput := get(5)
		if ttlInput != "" {
			parts := strings.Split(ttlInput, ",")
			if len(parts) >= 2 {
				tempat := strings.TrimSpace(parts[0])
				s.TTLTempat = &tempat
				tglStr := strings.TrimSpace(parts[1])
				
				// Coba beberapa format parse
				var t time.Time
				var err error
				formats := []string{"02-01-2006", "2006-01-02", "02/01/2006"}
				
				for _, format := range formats {
					t, err = time.Parse(format, tglStr)
					if err == nil {
						s.TTLTanggal = &t
						break
					}
				}
				
				if err != nil {
					parseErrors = append(parseErrors, models.ImportRowError{
						Baris: baris, Nama: nama, Pesan: "Format tanggal lahir tidak valid. Gunakan format DD-MM-YYYY atau YYYY-MM-DD.",
					})
					continue
				}
			} else {
				s.TTLTempat = &ttlInput // Kalau tidak ada koma, anggap semuanya Tempat
			}
		}

		s.NoHPWali = optStr(get(6))

		// Resolusi wilayah berdasarkan nama (berjenjang).
		provNama := get(7)
		kabNama := get(8)
		kecNama := get(9)

		if provNama != "" {
			prov, err := models.FindProvinsiByNama(ctx, provNama)
			if err != nil {
				parseErrors = append(parseErrors, models.ImportRowError{
					Baris: baris, Nama: nama, Pesan: fmt.Sprintf("Provinsi '%s' tidak ditemukan", provNama),
				})
				continue
			}
			s.ProvinsiKode = &prov.Kode
			s.ProvinsiNama = &prov.Nama

			if kabNama != "" {
				kab, err := models.FindKabupatenByNama(ctx, prov.Kode, kabNama)
				if err != nil {
					parseErrors = append(parseErrors, models.ImportRowError{
						Baris: baris, Nama: nama, Pesan: fmt.Sprintf("Kabupaten/Kota '%s' tidak ada di provinsi %s", kabNama, prov.Nama),
					})
					continue
				}
				s.KabupatenKode = &kab.Kode
				s.KabupatenNama = &kab.Nama

				if kecNama != "" {
					kec, err := models.FindKecamatanByNama(ctx, kab.Kode, kecNama)
					if err != nil {
						parseErrors = append(parseErrors, models.ImportRowError{
							Baris: baris, Nama: nama, Pesan: fmt.Sprintf("Kecamatan '%s' tidak ada di %s", kecNama, kab.Nama),
						})
						continue
					}
					s.KecamatanKode = &kec.Kode
					s.KecamatanNama = &kec.Nama
				}
			}
		}

		s.Desa = optStr(get(10))
		s.Alamat = optStr(get(11))
		s.Kamar = optStr(get(12))

		list = append(list, s)
		rowNumbers = append(rowNumbers, baris)
	}

	// Jika ada error parsing/validasi, jangan sentuh DB. Laporkan dulu.
	if len(parseErrors) > 0 {
		w.WriteHeader(http.StatusUnprocessableEntity)
		json.NewEncoder(w).Encode(models.ImportResult{
			Sukses: 0,
			Gagal:  len(parseErrors),
			Errors: parseErrors,
		})
		return
	}

	if len(list) == 0 {
		writeJSONError(w, "tidak ada data untuk diimpor", http.StatusBadRequest)
		return
	}

	res, err := models.ImportSantriBatch(ctx, list, rowNumbers)
	if err != nil {
		// Batch gagal (mis. duplikat). Kembalikan ringkasan dengan detail baris.
		w.WriteHeader(http.StatusUnprocessableEntity)
		json.NewEncoder(w).Encode(res)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": fmt.Sprintf("%d santri berhasil diimpor", res.Sukses),
		"sukses":  res.Sukses,
	})
}

func isEmptyRow(row []string) bool {
	for _, c := range row {
		if strings.TrimSpace(c) != "" {
			return false
		}
	}
	return true
}

// optStr mengembalikan pointer ke string, atau nil jika kosong.
func optStr(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
