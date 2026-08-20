package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

func GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(middleware.UserContextKey).(middleware.UserSession)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	stats, err := models.GetDashboardStats(r.Context(), user.Roles, user.PengajarID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(stats)
}
