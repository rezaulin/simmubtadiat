package main

import (
	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// registerAkademikRoutes: Struktur akademik, kalender, agenda, wilayah.
func registerAkademikRoutes(r chi.Router) {
	// Akademik (Pimpinan only for Create/Update). Wali santri tidak
	// boleh mengakses struktur akademik pondok.
	r.Route("/akademik", func(r chi.Router) {
		r.Use(appMiddleware.DenyRoles("wali_santri"))
		r.Get("/tingkatan", handlers.GetTingkatan)
		r.Get("/kelas", handlers.GetKelas)
		r.Get("/bagian", handlers.GetBagian)
		r.Get("/bagian-saya", handlers.GetBagianSaya)

		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin"))
			r.Post("/tingkatan", handlers.CreateTingkatan)
			r.Put("/tingkatan/{id}", handlers.UpdateTingkatan)
			r.Delete("/tingkatan/{id}", handlers.DeleteTingkatan)
			r.Post("/kelas", handlers.CreateKelas)
			r.Put("/kelas/{id}", handlers.UpdateKelas)
			r.Delete("/kelas/{id}", handlers.DeleteKelas)
			r.Post("/bagian", handlers.CreateBagian)
			r.Delete("/bagian/{id}", handlers.DeleteBagian)

			// Mapel CRUD
			r.Post("/mapel", handlers.CreateMapel)
			r.Put("/mapel/{id}", handlers.UpdateMapel)
			r.Delete("/mapel/{id}", handlers.DeleteMapel)

			// Susun ulang Nomor Stambuk posisi per tingkatan
			r.Post("/susun-stambuk", handlers.SusunUlangStambuk)
		})

		// Mapel Read
		r.Get("/mapel", handlers.GetMapelByKelas)

		// Jadwal CRUD
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin"))
			r.Post("/jadwal", handlers.CreateJadwal)
			r.Put("/jadwal/{id}", handlers.UpdateJadwal)
			r.Delete("/jadwal/{id}", handlers.DeleteJadwal)
		})

		r.Get("/jadwal", handlers.GetJadwalByBagian)
		r.Get("/jadwal-saya-hari-ini", handlers.GetJadwalSayaHariIni)
	})
	// Kalender
	r.Route("/kalender", func(r chi.Router) {
		r.Use(appMiddleware.DenyRoles("wali_santri"))
		r.Get("/", handlers.GetKalenderKuartal)
		r.Get("/tahun", handlers.GetTahunAjaran)
		// TA aktif — untuk default filter dropdown (menu Pelanggaran dkk).
		r.Get("/tahun-aktif", handlers.GetTahunAjaranAktifAPI)
		r.Get("/hijri-semester", handlers.GetKalenderSemesterHijri)
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin"))
			r.Post("/", handlers.SaveKalenderKuartal)
			r.Post("/hijri-semester", handlers.SaveKalenderSemesterHijri)
		})

	})
	// Agenda bebas (acara manual). Dibaca semua peran kecuali
	// wali_santri; ditulis hanya oleh pimpinan/admin.
	r.Route("/agenda", func(r chi.Router) {
		r.Use(appMiddleware.DenyRoles("wali_santri"))
		r.Get("/", handlers.GetAgenda)
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin"))
			r.Post("/", handlers.CreateAgenda)
			r.Put("/{id}", handlers.UpdateAgenda)
			r.Delete("/{id}", handlers.DeleteAgenda)
		})
	})
	// Wilayah (referensi alamat berjenjang untuk typeahead)
	r.Route("/wilayah", func(r chi.Router) {
		r.Use(appMiddleware.DenyRoles("wali_santri"))
		r.Get("/provinsi", handlers.GetProvinsi)
		r.Get("/kabupaten", handlers.GetKabupaten)
		r.Get("/kecamatan", handlers.GetKecamatan)
	})
}
