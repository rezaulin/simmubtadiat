package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

func Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if len(query) < 2 {
		writeJSONError(w, "Query minimal 2 karakter", http.StatusBadRequest)
		return
	}

	user, ok := r.Context().Value(middleware.UserContextKey).(middleware.UserSession)
	var roles []string
	var pengajarID *int
	if ok {
		roles = user.Roles
		pengajarID = user.PengajarID
	}

	results, err := models.GlobalSearch(r.Context(), query, roles, pengajarID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(results)
}
