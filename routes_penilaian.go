package main

import (
	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// registerPenilaianRoutes: Penilaian (kuartal/khos/bayan/lock), penilaian tambahan, raport.
func registerPenilaianRoutes(r chi.Router) {
	// Penilaian
	r.Route("/penilaian", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			// Mustahiq (and pimpinan, tim_rapot) can handle grades
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "mustahiq", "tim_rapot"))
			r.Post("/kuartal", handlers.BulkInputKuartal)
			r.Post("/khos", handlers.BulkInputKhos)
			r.Post("/bayan", handlers.BulkInputBayan)
			r.Post("/generate-khos", handlers.GenerateKhos)
			// Bulk: seluruh bagian sekaligus — dipanggil frontend otomatis
			// saat tabel dimuat supaya nilai raport langsung benar.
			r.Post("/generate-khos-bulk", handlers.GenerateKhosBulk)
			r.Post("/generate-am", handlers.GenerateAm)
			r.Post("/generate-bayan", handlers.GenerateBayan)
		})

		// Spreadsheet: read-only aggregate view for pimpinan/admin/mustahiq/mufatish/tim_rapot
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "mustahiq", "mufatish", "tim_rapot", "muroqib"))
			r.Get("/spreadsheet", handlers.GetPenilaianSpreadsheet)
			// Daftar bagian sesuai cakupan (mustahiq dibatasi kelas+tingkatannya).
			r.Get("/bagian", handlers.GetBagianPenilaian)
		})

		// Alur kunci & verifikasi nilai (per tahun_ajaran + semester).
		r.Route("/lock", func(r chi.Router) {
			// Baca status: pimpinan + admin + mustahiq + mufatish + tim_rapot.
			r.Group(func(r chi.Router) {
				r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "mustahiq", "mufatish", "tim_rapot", "muroqib"))
				r.Get("/status", handlers.GetStatusPenilaian)
			})
			// Konfirmasi bagian: mustahiq + tim_rapot (dan pimpinan override).
			r.Group(func(r chi.Router) {
				r.Use(appMiddleware.RequireRoles("pimpinan", "mustahiq", "tim_rapot"))
				r.Post("/confirm", handlers.ConfirmBagianHandler)
			})
			// Buka koreksi / kunci paksa / buka kunci: pimpinan.
			r.Group(func(r chi.Router) {
				r.Use(appMiddleware.RequireRoles("pimpinan"))
				r.Post("/open", handlers.OpenKoreksiHandler)
				r.Post("/force-lock", handlers.ForceLockHandler)
				r.Post("/unlock", handlers.UnlockHandler)
			})
		})
	})
	// Penilaian Tambahan — tab baru di dalam halaman Penilaian:
	// Di Bawah Rata², Setoran Juz Amma, Nilai Kompetensi.
	r.Route("/penilaian-tambahan", func(r chi.Router) {
		// Baca: pimpinan + mufatish + mustahiq (dibatasi cakupan)
		// + wali_santri (HANYA data anaknya — filter di handler).
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "mustahiq", "wali_santri"))
			r.Get("/bawah-rata", handlers.GetBawahRata)
			r.Get("/juz-amma", handlers.GetJuzAmma)
			r.Get("/kompetensi", handlers.GetKompetensi)
		})
		// Khusus wali: daftar anak (read-only).
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("wali_santri"))
			r.Get("/wali/anak", handlers.WaliAnak)
		})
		// Tulis + ekspor: pimpinan saja (keputusan owner;
		// cek role ekspor juga di dalam handler).
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireRoles("pimpinan"))
			r.Post("/bawah-rata/takziran", handlers.SaveTakziran)
			r.Post("/juz-amma", handlers.SaveJuzAmma)
			r.Post("/kompetensi", handlers.SaveKompetensi)
			r.Get("/export", handlers.ExportTambahan)
		})
	})
	r.Route("/laporan", func(r chi.Router) {
		// Semua role yang valid bisa akses rapot (difilter di handler khusus wali santri)
		r.Get("/raport/{santri_id}", handlers.GetRaport)
	})
}
