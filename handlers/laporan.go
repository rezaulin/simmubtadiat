package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/config"
	"github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

func GetRaport(w http.ResponseWriter, r *http.Request) {
	santriID, _ := strconv.Atoi(chi.URLParam(r, "santri_id"))
	semester, _ := strconv.Atoi(r.URL.Query().Get("semester"))
	if semester == 0 {
		semester = 1 // default
	}

	user, ok := r.Context().Value(middleware.UserContextKey).(middleware.UserSession)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Proteksi ketat untuk Wali Santri: hanya boleh lihat anak sendiri
	if user.HasRole("wali_santri") {
		var count int
		err := config.DB.QueryRow(r.Context(),
			"SELECT COUNT(id) FROM wali_santri_link WHERE user_id = $1 AND santri_id = $2",
			user.ID, santriID).Scan(&count)

		if err != nil || count == 0 {
			http.Error(w, "Akses Ditolak: Ini bukan data raport anak Anda", http.StatusForbidden)
			return
		}
	}

	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	if tahunAjaran == "" {
		tahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}

	res, err := models.GetRaportSantri(r.Context(), santriID, semester, tahunAjaran)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(res)
}
