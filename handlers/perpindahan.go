package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

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

	writeJSON(w, map[string]string{"status": "success", "message": "Proses pindah bagian/naik kelas berhasil"})
}

func UbahStatusSantri(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		SantriID      int    `json:"santri_id"`
		Status        string `json:"status"` // cuti, aktif, boyong, dikeluarkan
		TanggalStatus string `json:"tanggal_status"`
		Alasan        string `json:"alasan"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.SantriID == 0 {
		http.Error(w, "ID santri tidak valid", http.StatusBadRequest)
		return
	}

	// Validasi: alasan wajib untuk boyong/keluar/dikeluarkan
	if (req.Status == "boyong" || req.Status == "keluar" || req.Status == "dikeluarkan") && strings.TrimSpace(req.Alasan) == "" {
		http.Error(w, "Alasan wajib diisi untuk status boyong/keluar/dikeluarkan", http.StatusBadRequest)
		return
	}

	if err := models.UbahStatusStatusSantri(r.Context(), req.SantriID, req.Status, req.TanggalStatus, req.Alasan, user.Roles, user.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"status": "success", "message": "Status santri berhasil diubah"})
}
