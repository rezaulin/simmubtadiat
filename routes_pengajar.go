package main

import (
	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// registerPengajarRoutes: Penugasan, pengajar aktif, dewan harian, pengajar purna.
func registerPengajarRoutes(r chi.Router) {
	r.Route("/penugasan", func(r chi.Router) {
		// Baca penugasan: pimpinan + mufatish + mustahiq + admin/muroqib.
		// admin & muroqib read-only supaya modal Info Detail Pengajar
		// (dibuka dari menu Pengajar yang bisa diakses keduanya)
		// tidak error 403 pada bagian riwayat penugasan.
		// admin sengaja TIDAK boleh MENULIS penugasan — menu Penugasan
		// (tab kelola) tetap di luar cakupan admin.
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "mustahiq", "admin", "muroqib"))
			r.Get("/", handlers.GetPenugasan)
		})
		// Kelola penugasan (assign/hapus): pimpinan saja.
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan"))
			r.Get("/mufatish", handlers.GetMufatish)

			r.Post("/mufatish", handlers.AssignMufatish)
			r.Get("/mustahiq", handlers.GetMustahiq)
			r.Post("/mustahiq", handlers.AssignMustahiq)
			r.Get("/munawwib", handlers.GetMunawwib)
			r.Post("/munawwib", handlers.AssignMunawwib)
			r.Delete("/munawwib", handlers.RemoveMunawwib)
		})
	})
	// Pengajar & Dewan Harian (Fase 5)
	r.Route("/pengajar", func(r chi.Router) {
		// Read: pimpinan + admin + mufatish (read-only viewer)
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "mufatish", "mustahiq", "muroqib"))
			r.Get("/", handlers.GetPengajar)
			r.Get("/export", handlers.ExportPengajar)
			r.Get("/{id}", handlers.GetPengajarByID)
		})
		// Write: pimpinan only
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan"))
			r.Post("/", handlers.CreatePengajar)
			r.Put("/{id}", handlers.UpdatePengajar)
			r.Delete("/{id}", handlers.DeletePengajar)
			r.Post("/import", handlers.ImportPengajar)
			// Pindah pengajar aktif → arsip purna (bulk: body ids[], single: param id).
			// Status purna auto-copy; user login pengajar dimatikan + sesi diputus.
			r.Post("/pindah-purna", handlers.PindahPengajarPurna)
			r.Post("/{id}/pindah-purna", handlers.PindahPengajarPurna)
		})
	})
	r.Route("/dewan-harian", func(r chi.Router) {
		// Read: pimpinan + mufatish + mustahiq + muroqib + admin (admin read-only viewer)
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "mustahiq", "muroqib", "admin"))
			r.Get("/", handlers.GetDewanHarian)
			r.Get("/export", handlers.ExportDewanHarian)
		})
		// Write: pimpinan only
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan"))
			r.Post("/", handlers.AssignDewanHarian)
			r.Put("/{id}", handlers.UpdateDewanHarian)
			r.Delete("/{id}", handlers.DeleteDewanHarian)
			r.Get("/template", handlers.DownloadTemplateDewan)
			r.Post("/import", handlers.ImportDewanHarian)
		})
	})
	// Pengajar Purna (arsip pengajar lama).
	// Baca : pimpinan, admin & keamanan (menu MUSTAHIQ dihapuskan
	//
	//	sesuai permintaan terbaru — role gda tetap dapat lewat
	//	keamanan).
	//
	// Tulis : TETAP hanya pimpinan & admin.
	r.Route("/pengajar-purna", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "keamanan"))
			r.Get("/", handlers.GetPengajarPurna)
			r.Get("/export", handlers.ExportPengajarPurna)
			r.Get("/template", handlers.DownloadTemplatePengajarPurna)
		})
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin"))
			r.Post("/", handlers.CreatePengajarPurna)
			r.Post("/import", handlers.ImportPengajarPurna)
			r.Put("/{id}", handlers.UpdatePengajarPurna)
			r.Delete("/{id}", handlers.DeletePengajarPurna)
		})
	})
}
