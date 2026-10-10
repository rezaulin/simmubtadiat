package main

import (
	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// registerCatatanRoutes: Catatan pelanggaran/prestasi + perpindahan (naik kelas, status).
func registerCatatanRoutes(r chi.Router) {
	// Catatan Pelanggaran & Prestasi
	r.Route("/catatan", func(r chi.Router) {
		// Baca: pimpinan/admin/mufatish/mustahiq/muroqib/keamanan.
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "mufatish", "mustahiq", "muroqib", "keamanan"))
			r.Get("/", handlers.GetCatatan)
		})
		// Tulis/hapus: pimpinan/muroqib.
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "muroqib"))
			r.Post("/", handlers.CreateCatatan)
			r.Delete("/{id}", handlers.DeleteCatatan)
		})
	})
	// Perpindahan (Naik Kelas, Cuti)
	r.Route("/perpindahan", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "mustahiq", "admin"))
			r.Post("/naik-kelas", handlers.NaikKelas)
			r.Post("/status", handlers.UbahStatusSantri)
		})
	})
}
