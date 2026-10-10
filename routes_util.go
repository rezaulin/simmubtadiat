package main

import (
	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// registerUtilRoutes: Dashboard stats, data health, laporan/raport, rekap, settings.
func registerUtilRoutes(r chi.Router) {
	// Dashboard Stats (statistik pondok, bukan untuk wali_santri)
	r.Group(func(r chi.Router) {
		r.Use(appMiddleware.DenyRoles("wali_santri"))
		r.Get("/dashboard/stats", handlers.GetDashboardStats)
	})

	// Data Health (watchdog internal penilaian, khusus pimpinan/admin)
	r.Group(func(r chi.Router) {
		r.Use(appMiddleware.RequireRoles("pimpinan", "admin"))
		r.Get("/data-health", handlers.GetDataHealth)
	})
	// Pengaturan (Fase 8)
	r.Route("/settings", func(r chi.Router) {
		// Umum Settings (Read-only untuk semua pengguna)
		r.Get("/umum", handlers.GetSettingsUmum)

		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan"))

			// Raport Settings
			r.Get("/raport", handlers.GetRaportSettings)
			r.Put("/raport", handlers.UpdateRaportSettings)

			// Umum Settings (Update)
			r.Put("/umum", handlers.UpdateSettingsUmum)

			// Mudir per tingkatan (tanda tangan raport semester 2)
			r.Get("/mudir-tingkatan", handlers.GetMudirTingkatan)
			r.Put("/mudir-tingkatan", handlers.UpdateMudirTingkatan)
			r.Put("/mudir-tingkatan/tanda-tangan", handlers.UpdateMudirTandaTangan)

			// Users Management
			r.Get("/users", handlers.GetUsers)
			r.Post("/users", handlers.CreateUser)
			// Reset massal HARUS didaftarkan sebelum /users/{id}/...
			// agar chi memilih segmen statis ini (bukan {id}).
			r.Post("/users/reset-password-bulk", handlers.ResetPasswordBulk)
			r.Put("/users/{id}", handlers.UpdateUser)
			r.Delete("/users/{id}", handlers.DeleteUser)
			r.Post("/users/{id}/reset-password", handlers.ResetPassword)

			// Dynamic Columns
			r.Get("/dynamic-columns", handlers.GetDynamicColumns)
			r.Post("/dynamic-columns", handlers.CreateDynamicColumn)
			r.Put("/dynamic-columns/{id}", handlers.UpdateDynamicColumn)
			r.Delete("/dynamic-columns/{id}", handlers.DeleteDynamicColumn)
		})
	})
}
