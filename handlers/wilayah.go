package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/mubtadiaat/app/models"
)

// GetProvinsi mengembalikan daftar provinsi (dengan pencarian ketik lewat ?q=).
func GetProvinsi(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	res, err := models.SearchProvinsi(r.Context(), q)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

// GetKabupaten mengembalikan kabupaten pada provinsi tertentu (?provinsi= wajib, ?q= opsional).
func GetKabupaten(w http.ResponseWriter, r *http.Request) {
	provinsi := r.URL.Query().Get("provinsi")
	if provinsi == "" {
		writeJSONError(w, "parameter provinsi wajib diisi", http.StatusBadRequest)
		return
	}
	q := r.URL.Query().Get("q")
	res, err := models.SearchKabupaten(r.Context(), provinsi, q)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

// GetKecamatan mengembalikan kecamatan pada kabupaten tertentu (?kabupaten= wajib, ?q= opsional).
func GetKecamatan(w http.ResponseWriter, r *http.Request) {
	kabupaten := r.URL.Query().Get("kabupaten")
	if kabupaten == "" {
		writeJSONError(w, "parameter kabupaten wajib diisi", http.StatusBadRequest)
		return
	}
	q := r.URL.Query().Get("q")
	res, err := models.SearchKecamatan(r.Context(), kabupaten, q)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}
