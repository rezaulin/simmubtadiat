package handlers

import (
	"encoding/json"
	"net/http"
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

// GetKalenderSemesterHijri mengembalikan kalender semester Hijriyah suatu tahun ajaran.
func GetKalenderSemesterHijri(w http.ResponseWriter, r *http.Request) {
	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	if tahunAjaran == "" {
		tahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}
	res, err := models.GetKalenderSemesterHijri(r.Context(), tahunAjaran)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// SaveKalenderSemesterHijri menerima array kalender semester Hijriyah,
// sekaligus menyinkronkan kalender_kuartal (kompatibilitas rekap & lock).
func SaveKalenderSemesterHijri(w http.ResponseWriter, r *http.Request) {
	var entries []models.KalenderSemesterHijri
	if err := json.NewDecoder(r.Body).Decode(&entries); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	for _, e := range entries {
		if e.Semester != 1 && e.Semester != 2 {
			http.Error(w, "semester harus 1 atau 2", http.StatusBadRequest)
			return
		}
		if e.MulaiTanggal < 1 || e.MulaiTanggal > 30 || e.SelesaiTanggal < 1 || e.SelesaiTanggal > 30 ||
			e.MulaiBulanHijri < 1 || e.MulaiBulanHijri > 12 || e.SelesaiBulanHijri < 1 || e.SelesaiBulanHijri > 12 {
			http.Error(w, "tanggal Hijriyah tidak valid", http.StatusBadRequest)
			return
		}
	}
	if err := models.SaveKalenderSemesterHijri(r.Context(), entries); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"success"}`))
}
