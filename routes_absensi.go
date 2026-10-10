package main

import (
	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// registerAbsensiRoutes: Absensi pertemuan, manual, kuartal pengajar, rekap.
func registerAbsensiRoutes(r chi.Router) {
	// Absensi
	r.Route("/absensi", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "mustahiq", "mufatish", "muroqib"))
			r.Post("/input", handlers.InputAbsensi)
		})

		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan"))
			r.Post("/recalculate", handlers.RecalculateRekap)
		})

	})
	// Absensi Manual (harian)
	r.Route("/absensi-manual", func(r chi.Router) {
		r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "muroqib"))
		r.Get("/santri", handlers.GetAbsensiManualSantri)
		r.Post("/santri", handlers.SaveAbsensiManualSantri)
		r.Get("/pengajar", handlers.GetAbsensiManualPengajar)
		r.Post("/pengajar", handlers.SaveAbsensiManualPengajar)
	})
	// Absensi Pengajar Kuartal (input numerik per kuartal, ganti model bulanan)
	r.Route("/absensi-pengajar-kuartal", func(r chi.Router) {
		r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "muroqib", "mustahiq", "tim_rapot"))
		r.Get("/", handlers.GetAbsensiPengajarKuartal)
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "muroqib"))
			r.Post("/", handlers.SaveAbsensiPengajarKuartal)
		})
	})
	r.Route("/rekap", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "mufatish", "mustahiq", "muroqib", "tim_rapot", "keamanan"))
			r.Get("/absensi-siswa", handlers.GetRekapAbsensiSiswaRentang)

		})
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "tim_rapot", "mustahiq"))
			r.Get("/absensi-pengajar", handlers.GetLogAbsensiPengajar)
		})
	})
}
