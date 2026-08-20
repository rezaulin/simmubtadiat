package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/mubtadiaat/app/models"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

func NaikKelas(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		BagianAsalID   int   `json:"bagian_asal_id"`
		SantriIDs      []int `json:"santri_ids"`
		BagianBaruID   int   `json:"bagian_baru_id"`
		PindahMustahiq bool  `json:"pindah_mustahiq"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.PindahBagian(r.Context(), req.BagianAsalID, req.SantriIDs, req.BagianBaruID, req.PindahMustahiq, user.Roles, user.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Proses pindah bagian/naik kelas berhasil"})
}

func UbahStatusSantri(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		SantriID      int    `json:"santri_id"`
		Status        string `json:"status"` // cuti, aktif, boyong
		TanggalStatus string `json:"tanggal_status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.UbahStatusStatusSantri(r.Context(), req.SantriID, req.Status, req.TanggalStatus, user.Roles, user.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Status santri berhasil diubah"})
}
