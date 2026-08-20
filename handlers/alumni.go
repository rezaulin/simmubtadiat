package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/mubtadiaat/app/models"
)

func ProsesKeluar(w http.ResponseWriter, r *http.Request) {
	var req models.ProsesKeluarInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.ProsesKeluarSantri(r.Context(), req); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Proses keluar/lulus berhasil dicatat"})
}

func UpdateAlumni(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SantriID     int    `json:"santri_id"`
		StatusIjazah string `json:"status_ijazah"`
		NoIjazah     string `json:"no_ijazah"`
		Khidmah      string `json:"khidmah"`
		Keterangan   string `json:"keterangan"`
		// Biodata inti (opsional). Bila `nama` terisi, biodata santri ikut
		// diperbarui sehingga admin bisa mengoreksi data alumni yang salah.
		Nama          string `json:"nama"`
		TTLTempat     string `json:"ttl_tempat"`
		TTLTanggal    string `json:"ttl_tanggal"`
		NamaWali      string `json:"nama_wali"`
		NoHP          string `json:"no_hp_wali"`
		Alamat        string `json:"alamat"`
		Kamar         string `json:"kamar"`
		TahunMasuk    string `json:"tahun_masuk"`
		TahunKeluar   string `json:"tahun_keluar"`
		TempatKhidmah string `json:"tempat_khidmah"`
		AsalDaerah     string `json:"asal_daerah"`
		TingkatanAkhir string `json:"tingkatan_akhir"`
		AlasanIjazah   string `json:"alasan_ijazah_belum_diambil"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.UpdateAlumniDetail(r.Context(), req.SantriID, req.StatusIjazah, req.NoIjazah, req.Khidmah, req.Keterangan, req.AsalDaerah, req.TingkatanAkhir, req.AlasanIjazah); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Perbarui biodata santri bila payload menyertakan nama (form edit alumni).
	if req.Nama != "" {
		var ttlTanggal *time.Time
		if req.TTLTanggal != "" {
			// Terima format ISO "2006-01-02" maupun RFC3339.
			if t, err := time.Parse("2006-01-02", req.TTLTanggal); err == nil {
				ttlTanggal = &t
			} else if t, err := time.Parse(time.RFC3339, req.TTLTanggal); err == nil {
				ttlTanggal = &t
			}
		}
		bio := models.AlumniBiodataInput{
			Nama:          req.Nama,
			TTLTempat:     req.TTLTempat,
			TTLTanggal:    ttlTanggal,
			NamaWali:      req.NamaWali,
			NoHP:          req.NoHP,
			Alamat:        req.Alamat,
			Kamar:         req.Kamar,
			TahunMasuk:    req.TahunMasuk,
			TahunKeluar:   req.TahunKeluar,
			KhidmahTempat: req.TempatKhidmah,
		}
		if err := models.UpdateAlumniBiodata(r.Context(), req.SantriID, bio); err != nil {
			writeJSONError(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Data alumni berhasil diperbarui"})
}

// TambahAlumniManual menangani POST /api/alumni/tambah-manual: input satu alumni manual.
func TambahAlumniManual(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Nama          string `json:"nama"`
		Stambuk       string `json:"stambuk"`
		NISN          string `json:"nisn"`
		TTL           string `json:"ttl"`
		Wali          string `json:"wali"`
		Alamat        string `json:"alamat"`
		NoHP          string `json:"no_hp"`
		Khidmah       string `json:"khidmah"`
		TempatKhidmah string `json:"tempat_khidmah"`
		StatusIjazah  string `json:"status_ijazah"`
		Keterangan    string `json:"keterangan"`
		TahunMasuk    string `json:"tahun_masuk"`
		TahunKeluar   string `json:"tahun_keluar"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Nama == "" || req.Stambuk == "" {
		writeJSONError(w, "Nama dan Stambuk wajib diisi", http.StatusBadRequest)
		return
	}

	err := models.TambahAlumniManual(r.Context(), req.Nama, req.Stambuk, req.NISN, req.TTL, req.Wali,
		req.Alamat, req.NoHP, req.Khidmah, req.TempatKhidmah, req.StatusIjazah, req.Keterangan,
		req.TahunMasuk, req.TahunKeluar)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Alumni berhasil ditambahkan"})
}

func GetAlumni(w http.ResponseWriter, r *http.Request) {
	filter := models.AlumniFilter{
		StatusAkhir:   r.URL.Query().Get("status_akhir"),
		ProvinsiKode:  r.URL.Query().Get("provinsi"),
		KabupatenKode: r.URL.Query().Get("kabupaten"),
	}

	res, err := models.GetAllAlumni(r.Context(), filter)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// ImportAlumniExcel mengimpor data alumni dari file Excel (.xlsx).
// Kolom yang dikenali sama persis dengan kolom santri.
// Status default "lulus", tingkatan_akhir dari kolom "Tingkatan Akhir".
// Duplikat NIK di-skip dan dilaporkan.
func ImportAlumniExcel(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Gagal membaca file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	result, err := models.ImportAlumniFromExcel(r.Context(), file)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(result)
}
