package main

import (
	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// registerSantriRoutes: Data santri, riwayat akademik, stambuk.
func registerSantriRoutes(r chi.Router) {
	// Santri
	r.Route("/santri", func(r chi.Router) {
		// Daftar lengkap santri: dibutuhkan untuk data santri & rapot.
		// Munawwib (absensi saja) tidak perlu; wali_santri diblok; tim_rapot butuh baca untuk rapot.
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "mufatish", "mustahiq", "muroqib", "tim_rapot", "keamanan"))
			r.Get("/", handlers.GetSantriAktif)
		})

		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin"))
			r.Get("/export", handlers.ExportSantri)
		})

		// Daftar per bagian: dipakai form input absensi (munawwib & mustahiq).
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.DenyRoles("wali_santri"))
			r.Get("/by-bagian/{bagianId}", handlers.GetSantriByBagian)
		})

		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "keamanan", "mustahiq"))
			r.Get("/arsip", handlers.GetArsipSantri)
		})

		// Semua aksi tulis data santri: pimpinan saja.
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan"))
			r.Post("/", handlers.RegisterSantri)
			// Impor massal via Excel + unduh template
			r.Get("/template-import", handlers.DownloadTemplateSantri)
			r.Post("/import", handlers.ImportSantri)
			r.Post("/{id}/foto", handlers.UploadFotoSantri)
			r.Post("/assign", handlers.AssignBagian)
			r.Get("/fix-stambuk", handlers.FixStambukSantri)
			r.Put("/{id}", handlers.UpdateSantri)
			r.Delete("/{id}", handlers.DeleteSantri)
		})

		// Detail & riwayat akademik: wali_santri boleh, tapi dibatasi
		// hanya untuk anak yang tertaut ke akunnya (cek di handler/model).
		r.Get("/{id}", handlers.GetSantriByID)
		r.Get("/{id}/riwayat-akademik", handlers.GetRiwayatAkademikSantri)
	})
	// Stambuk (Susun Ulang No. Stambuk per Tingkatan/Kelas & Massal)
	r.Route("/stambuk", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "mufatish"))
			r.Get("/kelas", handlers.GetStambukKelas)
		})
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan"))
			r.Post("/susun-ulang", handlers.SusunUlangStambuk)
			r.Post("/bulk-update", handlers.BulkUpdateStambuk)
		})
	})
}
