package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/models"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

func GetPengajar(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	bagianID, _ := strconv.Atoi(r.URL.Query().Get("bagian_id"))
	tingkatanID, _ := strconv.Atoi(r.URL.Query().Get("tingkatan_id"))
	kelasID, _ := strconv.Atoi(r.URL.Query().Get("kelas_id"))

	res, err := models.GetAllPengajar(r.Context(), user.Roles, user.PengajarID, bagianID, tingkatanID, kelasID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func CreatePengajar(w http.ResponseWriter, r *http.Request) {
	var p models.Pengajar
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.CreatePengajar(r.Context(), p); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Pengajar berhasil ditambahkan"})
}

func UpdatePengajar(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	var p models.Pengajar
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := models.UpdatePengajar(r.Context(), id, p); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Pengajar berhasil diperbarui"})
}

func DeletePengajar(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	if err := models.DeletePengajar(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Pengajar berhasil dihapus"})
}

func GetDewanHarian(w http.ResponseWriter, r *http.Request) {
	tahun := r.URL.Query().Get("tahun_ajaran")
	res, err := models.GetDewanHarian(r.Context(), tahun)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func AssignDewanHarian(w http.ResponseWriter, r *http.Request) {
	var req models.DewanHarian
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.AssignDewanHarian(r.Context(), req); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Jabatan dewan harian berhasil dicatat"})
}

func UpdateDewanHarian(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	var dh models.DewanHarian
	if err := json.NewDecoder(r.Body).Decode(&dh); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := models.UpdateDewanHarian(r.Context(), id, dh); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Dewan Harian berhasil diperbarui"})
}

func DeleteDewanHarian(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	if err := models.DeleteDewanHarian(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Dewan Harian berhasil dihapus"})
}

// Mufatish
func GetMufatish(w http.ResponseWriter, r *http.Request) {
	res, err := models.GetMufatishAssignments(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func AssignMufatish(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PengajarID  int `json:"pengajar_id"`
		KelasID     int `json:"kelas_id"`
		TingkatanID int `json:"tingkatan_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.PengajarID == 0 {
		models.RevokeMufatish(r.Context(), req.KelasID, req.TingkatanID)
	} else {
		models.AssignMufatish(r.Context(), req.PengajarID, req.KelasID, req.TingkatanID)
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Mustahiq
func GetMustahiq(w http.ResponseWriter, r *http.Request) {
	res, err := models.GetMustahiqAssignments(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func AssignMustahiq(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PengajarID int `json:"pengajar_id"`
		BagianID   int `json:"bagian_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.PengajarID == 0 {
		models.RevokeMustahiq(r.Context(), req.BagianID)
	} else {
		models.AssignMustahiq(r.Context(), req.PengajarID, req.BagianID)
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}
func GetPengajarByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	pengajar, err := models.GetPengajarByID(r.Context(), id)
	if err != nil {
		http.Error(w, "Pengajar not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pengajar)
}

func AssignMunawwib(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BagianID   int   `json:"bagian_id"`
		PengajarIDs []int `json:"pengajar_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	err := models.AssignMunawwibs(r.Context(), req.BagianID, req.PengajarIDs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func GetMunawwib(w http.ResponseWriter, r *http.Request) {
	assignments, err := models.GetMunawwibAssignments(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(assignments)
}


func RemoveMunawwib(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BagianID   int `json:"bagian_id"`
		PengajarID int `json:"pengajar_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	err := models.RemoveMunawwib(r.Context(), req.BagianID, req.PengajarID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

