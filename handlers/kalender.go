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
