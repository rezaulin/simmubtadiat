package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"github.com/mubtadiaat/app/models"
)

func GetKalenderKuartal(w http.ResponseWriter, r *http.Request) {
	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	if tahunAjaran == "" {
		tahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}

	res, err := models.GetKalenderByTahun(r.Context(), tahunAjaran)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func SaveKalenderKuartal(w http.ResponseWriter, r *http.Request) {
	var input []models.KalenderKuartal
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	for _, k := range input {
		if err := models.UpsertKalender(r.Context(), k); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"success"}`))
}

func GetTahunAjaran(w http.ResponseWriter, r *http.Request) {
	res, err := models.GetTahunAjaran(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// GetHijriSemesterMap mengembalikan mapping bulan Hijri -> semester.
// Query: ?tahun_hijri=1447 (opsional).
func GetHijriSemesterMap(w http.ResponseWriter, r *http.Request) {
	th, _ := strconv.Atoi(r.URL.Query().Get("tahun_hijri"))
	res, err := models.GetHijriSemesterMap(r.Context(), th)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// SaveHijriSemesterMap menerima array mapping bulan Hijri -> semester,
// otomatis backfill baris absensi manual yang cocok.
func SaveHijriSemesterMap(w http.ResponseWriter, r *http.Request) {
	var entries []models.HijriSemesterMap
	if err := json.NewDecoder(r.Body).Decode(&entries); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	for _, e := range entries {
		if e.BulanHijri < 1 || e.BulanHijri > 12 || (e.Semester != 1 && e.Semester != 2) {
			http.Error(w, "bulan_hijri harus 1-12 dan semester harus 1 atau 2", http.StatusBadRequest)
			return
		}
	}
	if err := models.SaveHijriSemesterMap(r.Context(), entries); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"success"}`))
}
