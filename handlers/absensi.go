package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// InputAbsensi handles bulk daily attendance input
func InputAbsensi(w http.ResponseWriter, r *http.Request) {
	// Ambil data user dari context (di-set oleh RequireAuth)
	user, ok := r.Context().Value(middleware.UserContextKey).(middleware.UserSession)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var in models.SesiAbsensiInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.InputAbsensiSesi(r.Context(), in, user.PengajarID, user.Roles); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden) // Return 403 for RBAC failures
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Absensi berhasil disimpan"})
}

// RecalculateRekap triggers summary recalculation for a student and a kuartal
func RecalculateRekap(w http.ResponseWriter, r *http.Request) {
	var req struct {
		KuartalID int `json:"kuartal_id"`
		SantriID  int `json:"santri_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.RecalculateRekapAbsensi(r.Context(), req.KuartalID, req.SantriID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Rekap absensi diperbarui"})
}
