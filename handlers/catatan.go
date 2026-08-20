package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// GetCatatan mengembalikan catatan. Jika query santri_id ada → daftar per santri;
// jika tidak → daftar semua (dengan filter jenis & keyword) untuk menu khusus.
func GetCatatan(w http.ResponseWriter, r *http.Request) {
	santriIDStr := r.URL.Query().Get("santri_id")
	if santriIDStr != "" {
		santriID, err := strconv.Atoi(santriIDStr)
		if err != nil {
			http.Error(w, "santri_id tidak valid", http.StatusBadRequest)
			return
		}
		res, err := models.GetCatatanBySantri(r.Context(), santriID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(res)
		return
	}

	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	res, err := models.GetRekapCatatan(r.Context(), r.URL.Query().Get("q"), user.Roles, user.PengajarID, user.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

// CreateCatatan menambah catatan (pimpinan/admin/mustahiq).
func CreateCatatan(w http.ResponseWriter, r *http.Request) {
	var in models.CatatanInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if err := models.CreateCatatan(r.Context(), in, user.Roles, user.ID, user.PengajarID); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Catatan tersimpan"})
}

// DeleteCatatan menghapus catatan (pimpinan/admin bebas; mustahiq hanya miliknya).
func DeleteCatatan(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "id tidak valid", http.StatusBadRequest)
		return
	}
	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if err := models.DeleteCatatan(r.Context(), id, user.Roles, user.ID); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Catatan dihapus"})
}
