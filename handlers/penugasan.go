package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/models"
)

func AssignPengajar(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PengajarID  int    `json:"pengajar_id"`
		BagianID    int    `json:"bagian_id"`
		TahunAjaran string `json:"tahun_ajaran"`
		Peran       string `json:"peran"` // 'mustahiq' or 'muroqib'
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.AssignPengajarToBagian(r.Context(), req.PengajarID, req.BagianID, req.TahunAjaran, req.Peran); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Penugasan berhasil dicatat"})
}

func GetPenugasan(w http.ResponseWriter, r *http.Request) {
	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	bagianID := r.URL.Query().Get("bagian_id")
	pengajarID := r.URL.Query().Get("pengajar_id")

	res, err := models.GetPengajarBagian(r.Context(), tahunAjaran, bagianID, pengajarID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func DeletePenugasan(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.Atoi(idStr)

	if err := models.DeletePengajarBagian(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}
