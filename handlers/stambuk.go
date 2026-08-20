package handlers

import (
	"encoding/json"
	"net/http"

	"strconv"

	"github.com/mubtadiaat/app/models"
)

// SusunUlangStambuk menyusun ulang Stambuk posisi untuk satu tingkatan.
func SusunUlangStambuk(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TingkatanID int `json:"tingkatan_id"`
		KelasID     int `json:"kelas_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TingkatanID <= 0 || req.KelasID <= 0 {
		http.Error(w, "tingkatan_id dan kelas_id wajib", http.StatusBadRequest)
		return
	}

	count, err := models.SusunUlangStambuk(r.Context(), req.TingkatanID, req.KelasID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Stambuk berhasil disusun ulang",
		"count":   count,
	})
}

// GetStambukKelas menangani GET /api/stambuk/kelas?tingkatan_id=X&kelas_id=Y
func GetStambukKelas(w http.ResponseWriter, r *http.Request) {
	tingkatanIDStr := r.URL.Query().Get("tingkatan_id")
	kelasIDStr := r.URL.Query().Get("kelas_id")

	tingkatanID, err := strconv.Atoi(tingkatanIDStr)
	if err != nil || tingkatanID <= 0 {
		writeJSONError(w, "tingkatan_id wajib diisi (angka)", http.StatusBadRequest)
		return
	}
	kelasID, err := strconv.Atoi(kelasIDStr)
	if err != nil || kelasID <= 0 {
		writeJSONError(w, "kelas_id wajib diisi (angka)", http.StatusBadRequest)
		return
	}

	data, err := models.GetStambukKelas(r.Context(), tingkatanID, kelasID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// BulkUpdateStambuk menangani POST /api/stambuk/bulk-update
func BulkUpdateStambuk(w http.ResponseWriter, r *http.Request) {
	var items []models.StambukUpdateItem
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		writeJSONError(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.BulkUpdateStambuk(r.Context(), items); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Stambuk berhasil diperbarui",
		"count":   len(items),
	})
}
