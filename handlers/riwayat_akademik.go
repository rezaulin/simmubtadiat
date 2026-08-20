package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/config"
	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

func GetRiwayatAkademikSantri(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSONError(w, "ID santri tidak valid", http.StatusBadRequest)
		return
	}

	// Proteksi wali_santri: hanya boleh melihat riwayat anak yang tertaut ke akunnya.
	if user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession); ok && user.HasRole("wali_santri") {
		var count int
		err := config.DB.QueryRow(r.Context(),
			"SELECT COUNT(id) FROM wali_santri_link WHERE user_id = $1 AND santri_id = $2",
			user.ID, id).Scan(&count)
		if err != nil || count == 0 {
			writeJSONError(w, "Akses Ditolak: Ini bukan data anak Anda", http.StatusForbidden)
			return
		}
	}

	res, err := models.GetRiwayatAkademik(r.Context(), id)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}
