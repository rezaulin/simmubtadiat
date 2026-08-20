package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mubtadiaat/app/models"
)

// GetNisKelas menangani GET /api/nis/kelas?tingkatan_id=X&kelas_id=Y
func GetNisKelas(w http.ResponseWriter, r *http.Request) {
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

	data, err := models.GetNisKelas(r.Context(), tingkatanID, kelasID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// BulkUpdateNIS menangani POST /api/nis/bulk-update
func BulkUpdateNIS(w http.ResponseWriter, r *http.Request) {
	var items []models.NisUpdateItem
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		writeJSONError(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.BulkUpdateNIS(r.Context(), items); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "NIS berhasil diperbarui",
		"count":   len(items),
	})
}
