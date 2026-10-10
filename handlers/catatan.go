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
		// Filter tahun ajaran opsional (menu Pelanggaran):
		// "semua" atau tanpa param = seluruh riwayat.
		ta := r.URL.Query().Get("tahun_ajaran")
		if ta == "semua" {
			ta = ""
		}
		res, err := models.GetCatatanBySantri(r.Context(), santriID, ta)
		if err != nil {
			http.Error(w, internalError("", err), http.StatusInternalServerError)
			return
		}
		writeJSON(w, res)
		return
	}

	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	// Rekap dihitung per tahun ajaran; default = tahun ajaran aktif.
	// ?tahun_ajaran=2025/2026 → TA itu; ?tahun_ajaran=semua → lintas tahun.
	ta := r.URL.Query().Get("tahun_ajaran")
	if ta == "semua" {
		ta = ""
	} else if ta == "" {
		ta = models.GetTahunAjaranAktif(r.Context())
	}
	res, err := models.GetRekapCatatan(r.Context(), r.URL.Query().Get("q"), ta, user.Roles, user.PengajarID, user.ID)
	if err != nil {
		http.Error(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	writeJSON(w, res)
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
	writeJSON(w, map[string]string{"status": "success", "message": "Catatan tersimpan"})
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
	writeJSON(w, map[string]string{"status": "success", "message": "Catatan dihapus"})
}
