package main

import (
	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// registerLandingRoutes: admin CMS landing page (khusus pimpinan).
// Dipanggil di dalam group RequireAuth + CSRF + RequirePasswordChanged,
// jadi semua route berada di bawah /api/landing/admin/... .
func registerLandingRoutes(r chi.Router) {
	r.Route("/landing/admin", func(r chi.Router) {
		r.Use(appMiddleware.RequireRoles("pimpinan"))

		r.Get("/sections", handlers.AdminListSections)
		r.Post("/sections", handlers.AdminCreateSection)
		r.Put("/sections/{id}", handlers.AdminUpdateSection)
		r.Delete("/sections/{id}", handlers.AdminDeleteSection)

		r.Get("/settings", handlers.AdminGetSettings)
		r.Put("/settings", handlers.AdminUpdateSettings)

		// Foto: upload, daftar, hapus (dipakai tombol Upload + galeri di panel).
		r.Post("/upload", handlers.AdminUploadLandingImage)
		r.Get("/images", handlers.AdminListLandingImages)
		r.Delete("/images/{name}", handlers.AdminDeleteLandingImage)

		// Berita pesantren (beranda + /berita). CRUD penuh dari panel.
		r.Get("/news", handlers.AdminListNews)
		r.Post("/news", handlers.AdminCreateNews)
		r.Put("/news/{id}", handlers.AdminUpdateNews)
		r.Delete("/news/{id}", handlers.AdminDeleteNews)
	})
}
