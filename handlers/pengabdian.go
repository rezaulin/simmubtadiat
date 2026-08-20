package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/mubtadiaat/app/models"
)

// MulaiPengabdian menangani POST /api/pengabdian/mulai: transisi santri
// aktif → pengabdian. Error validasi/status dari model diperlakukan sebagai
// 400 (Bad Request) sesuai tabel Error Handling design.
func MulaiPengabdian(w http.ResponseWriter, r *http.Request) {
	var req models.MulaiPengabdianInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.MulaiPengabdian(r.Context(), req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Pengabdian berhasil dimulai"})
}

// SelesaiPengabdian menangani POST /api/pengabdian/selesai: transisi santri
// pengabdian → lulus. Error validasi/status dari model diperlakukan sebagai
// 400 (Bad Request) sesuai tabel Error Handling design.
func SelesaiPengabdian(w http.ResponseWriter, r *http.Request) {
	var req models.SelesaiPengabdianInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.SelesaiPengabdian(r.Context(), req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Pengabdian berhasil diselesaikan"})
}

// GetPengabdian menangani GET /api/pengabdian: daftar santri berstatus
// pengabdian. Kegagalan DB dikembalikan sebagai 500 (Internal Server Error).
func GetPengabdian(w http.ResponseWriter, r *http.Request) {
	res, err := models.GetSantriPengabdian(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}
