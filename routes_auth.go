package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// registerAuthRoutes: info user login (/me), akses wali santri, pencarian global.
func registerAuthRoutes(r chi.Router) {
	// Get current user info
	r.Get("/me", func(w http.ResponseWriter, r *http.Request) {
		user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
		resp := map[string]interface{}{
			"status": "ok",
			"role":   user.Role,
			"roles":  user.Roles,
			"nama":   user.Nama,
		}
		if user.PengajarID != nil {
			resp["pengajar_id"] = *user.PengajarID
		}
		writeJSON(w, resp)
	})

	// Wali Santri: daftar anak yang tertaut ke akunnya
	r.Get("/wali/anak", handlers.GetAnakWali)
	r.Get("/wali/catatan", handlers.GetCatatanAnakWali)

	// Global Search (wali_santri tidak boleh mencari data santri lain)
	r.Group(func(r chi.Router) {
		r.Use(appMiddleware.DenyRoles("wali_santri"))
		r.Get("/search", handlers.Search)
	})
}
