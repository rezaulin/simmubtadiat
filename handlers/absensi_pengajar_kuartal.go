package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// GetAbsensiPengajarKuartal returns all teachers (mustahiq + munawwib) with their
// quarterly attendance. Teachers without records still appear (zeros). Used for both
// the Input page and the Rekap page. Filter by tingkatan_id, kelas_id, tahun_ajaran.
func GetAbsensiPengajarKuartal(w http.ResponseWriter, r *http.Request) {
	if _, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession); !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	tingkatanID, _ := strconv.Atoi(r.URL.Query().Get("tingkatan_id"))
	kelasID, _ := strconv.Atoi(r.URL.Query().Get("kelas_id"))
	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	if tahunAjaran == "" {
		http.Error(w, "tahun_ajaran wajib diisi", http.StatusBadRequest)
		return
	}

	res, err := models.GetAbsensiPengajarKuartal(r.Context(), tingkatanID, kelasID, tahunAjaran)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

// SaveAbsensiPengajarKuartal upserts quarterly attendance numbers for a batch of teachers.
func SaveAbsensiPengajarKuartal(w http.ResponseWriter, r *http.Request) {
	if _, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession); !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		TahunAjaran string                            `json:"tahun_ajaran"`
		Data        []models.AbsensiPengajarKuartal `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.TahunAjaran == "" {
		http.Error(w, "tahun_ajaran wajib diisi", http.StatusBadRequest)
		return
	}

	if err := models.SaveAbsensiPengajarKuartal(r.Context(), req.TahunAjaran, req.Data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Absensi pengajar berhasil disimpan"})
}
