package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// --- Tingkatan ---
func GetTingkatan(w http.ResponseWriter, r *http.Request) {
	res, err := models.GetAllTingkatan(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func CreateTingkatan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Nama   string `json:"nama"`
		Urutan int    `json:"urutan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.CreateTingkatan(r.Context(), req.Nama, req.Urutan); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func UpdateTingkatan(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	var req struct {
		Nama     string `json:"nama"`
		Urutan   int    `json:"urutan"`
		IsActive bool   `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.UpdateTingkatan(r.Context(), id, req.Nama, req.Urutan, req.IsActive); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func DeleteTingkatan(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	if err := models.DeleteTingkatan(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}


// --- Kelas ---
func GetKelas(w http.ResponseWriter, r *http.Request) {
	res, err := models.GetAllKelas(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func CreateKelas(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Nama       string `json:"nama"`
		TahunMasuk string `json:"tahun_masuk"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if err := models.CreateKelas(r.Context(), req.Nama, req.TahunMasuk); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func DeleteKelas(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	if err := models.DeleteKelas(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// --- Bagian ---
func GetBagian(w http.ResponseWriter, r *http.Request) {
	res, err := models.GetBagian(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func CreateBagian(w http.ResponseWriter, r *http.Request) {
	var req struct {
		KelasID     int    `json:"kelas_id"`
		TingkatanID int    `json:"tingkatan_id"`
		NamaBagian  string `json:"nama_bagian"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if err := models.CreateBagian(r.Context(), req.KelasID, req.TingkatanID, req.NamaBagian); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func DeleteBagian(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	if err := models.DeleteBagian(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// GetBagianSaya returns bagian assigned to the logged-in pengajar
func GetBagianSaya(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(middleware.UserContextKey).(middleware.UserSession)
	if !ok || user.PengajarID == nil {
		http.Error(w, "Pengajar ID tidak ditemukan", http.StatusForbidden)
		return
	}

	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	res, err := models.GetBagianByPengajarID(r.Context(), *user.PengajarID, tahunAjaran)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}
