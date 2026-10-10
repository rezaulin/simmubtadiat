package main

import (
	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// registerAlumniRoutes: Alumni & kelulusan, pengabdian/khidmah.
func registerAlumniRoutes(r chi.Router) {
	// Alumni & Kelulusan
	r.Route("/alumni", func(r chi.Router) {
		// Write: pimpinan only (admin bersifat read-only)
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan"))
			r.Post("/proses-keluar", handlers.ProsesKeluar)
			r.Put("/update", handlers.UpdateAlumni)
			r.Post("/import", handlers.ImportAlumniExcel)
			r.Get("/template", handlers.DownloadTemplateAlumni)
			r.Post("/tambah-manual", handlers.TambahAlumniManual)
		})
		// Read: pimpinan + keamanan + admin (admin read-only viewer)
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "keamanan", "admin"))
			r.Get("/", handlers.GetAlumni)
		})
	})
	// Pengabdian / Khidmah (Santri Pengabdian)
	r.Route("/pengabdian", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan"))
			r.Post("/mulai", handlers.MulaiPengabdian)
			r.Post("/selesai", handlers.SelesaiPengabdian)
			r.Post("/import", handlers.ImportPengabdianExcel)
			r.Get("/template", handlers.DownloadTemplatePengabdian)
		})
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "keamanan", "admin"))
			r.Get("/", handlers.GetPengabdian)
		})
	})
}
