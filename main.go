package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mubtadiaat/app/config"
	"github.com/mubtadiaat/app/handlers"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

func main() {
	// Initialize Database
	config.ConnectDB()

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// NoCache Middleware to prevent browser caching API responses
	noCache := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			next.ServeHTTP(w, r)
		})
	}

	// API Routes
	r.Route("/api", func(r chi.Router) {
		r.Use(noCache)
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("OK"))
		})
		// Public Routes
		r.Post("/login", handlers.Login)
		r.Post("/login-wali", handlers.LoginWali)
		r.Post("/logout", handlers.Logout)

		// Protected Routes
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireAuth)

			// Can change password without RequirePasswordChanged middleware blocking it
			r.Post("/change-password", handlers.ChangePassword)

			r.Group(func(r chi.Router) {
				r.Use(appMiddleware.RequirePasswordChanged)

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
					json.NewEncoder(w).Encode(resp)
				})

				// Wali Santri: daftar anak yang tertaut ke akunnya
				r.Get("/wali/anak", handlers.GetAnakWali)

				// Global Search (wali_santri tidak boleh mencari data santri lain)
				r.Group(func(r chi.Router) {
					r.Use(appMiddleware.DenyRoles("wali_santri"))
					r.Get("/search", handlers.Search)
				})

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
					r.Group(func(r chi.Router) {
						r.Use(appMiddleware.RequireRoles("pimpinan", "admin"))
						r.Post("/", handlers.SaveKalenderKuartal)
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

				// Santri
				r.Route("/santri", func(r chi.Router) {
					// Daftar lengkap santri: dibutuhkan untuk data santri & rapot.
					// Munawwib (absensi saja) tidak perlu; wali_santri diblok.
					r.Group(func(r chi.Router) {
						r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "mufatish", "mustahiq", "muroqib", "keamanan"))
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
						r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "keamanan"))
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

				r.Route("/penugasan", func(r chi.Router) {
					// Baca penugasan: pimpinan + mufatish + mustahiq.
					// admin sengaja TIDAK termasuk — menu Penugasan di luar cakupan admin.
					r.Group(func(r chi.Router) {
						r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "mustahiq"))
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

				// Penilaian
				r.Route("/penilaian", func(r chi.Router) {
					r.Group(func(r chi.Router) {
						// Mustahiq (and pimpinan, tim_rapot) can handle grades
						r.Use(appMiddleware.RequireRoles("pimpinan", "mustahiq", "tim_rapot"))
						r.Post("/kuartal", handlers.BulkInputKuartal)
						r.Post("/khos", handlers.BulkInputKhos)
						r.Post("/bayan", handlers.BulkInputBayan)
						r.Post("/generate-khos", handlers.GenerateKhos)
						r.Post("/generate-am", handlers.GenerateAm)
						r.Post("/generate-bayan", handlers.GenerateBayan)
					})

					// Spreadsheet: read-only aggregate view for pimpinan/mustahiq/mufatish/tim_rapot
					r.Group(func(r chi.Router) {
						r.Use(appMiddleware.RequireRoles("pimpinan", "mustahiq", "mufatish", "tim_rapot", "muroqib"))
						r.Get("/spreadsheet", handlers.GetPenilaianSpreadsheet)
						// Daftar bagian sesuai cakupan (mustahiq dibatasi kelas+tingkatannya).
						r.Get("/bagian", handlers.GetBagianPenilaian)
					})

					// Alur kunci & verifikasi nilai (per tahun_ajaran + semester).
					r.Route("/lock", func(r chi.Router) {
						// Baca status: pimpinan + mustahiq + mufatish + tim_rapot.
						r.Group(func(r chi.Router) {
							r.Use(appMiddleware.RequireRoles("pimpinan", "mustahiq", "mufatish", "tim_rapot", "muroqib"))
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
					})
					r.Group(func(r chi.Router) {
						r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "keamanan", "admin"))
						r.Get("/", handlers.GetPengabdian)
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
					})
				})

				r.Route("/dewan-harian", func(r chi.Router) {
					// Read: pimpinan + mufatish + mustahiq + muroqib + admin (admin read-only viewer)
					r.Group(func(r chi.Router) {
						r.Use(appMiddleware.RequireRoles("pimpinan", "mufatish", "mustahiq", "muroqib", "admin"))
						r.Get("/", handlers.GetDewanHarian)
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

				// Pengajar Purna (arsip pengajar lama). Fitur khusus: hanya
				// admin & pimpinan yang boleh membaca maupun mengelola (RBAC di sini
				// adalah lapisan keamanan sebenarnya; menu frontend hanya kosmetik).
				r.Route("/pengajar-purna", func(r chi.Router) {
					r.Use(appMiddleware.RequireRoles("pimpinan", "admin"))
					r.Get("/", handlers.GetPengajarPurna)
					r.Get("/export", handlers.ExportPengajarPurna)
					r.Get("/template", handlers.DownloadTemplatePengajarPurna)
					r.Post("/", handlers.CreatePengajarPurna)
					r.Post("/import", handlers.ImportPengajarPurna)
					r.Put("/{id}", handlers.UpdatePengajarPurna)
					r.Delete("/{id}", handlers.DeletePengajarPurna)
				})

				// Dashboard Stats (statistik pondok, bukan untuk wali_santri)
				r.Group(func(r chi.Router) {
					r.Use(appMiddleware.DenyRoles("wali_santri"))
					r.Get("/dashboard/stats", handlers.GetDashboardStats)
				})

				r.Route("/laporan", func(r chi.Router) {
					// Semua role yang valid bisa akses rapot (difilter di handler khusus wali santri)
					r.Get("/raport/{santri_id}", handlers.GetRaport)
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

				// Catatan: route baca/tulis Kalender Kuartal sudah didefinisikan di
				// grup r.Route("/kalender") di atas (GET baca untuk semua kecuali
				// wali_santri; POST tulis admin-only). Blok admin-only duplikat yang
				// sebelumnya di sini menaungi GET /api/kalender sehingga mustahiq/
				// mufatish/munawwib kena 403 — sudah dihapus.

			}) // <-- Close r.Group for RequirePasswordChanged
		})
	}) // <-- Close /api route

	// Serve Static Files (Frontend)
	workDir, _ := os.Getwd()
	filesDir := filepath.Join(workDir, "public", "dist")

	// Create a catch-all route to serve static files or fallback to index.html for SPA routing
	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		filePath := filepath.Join(filesDir, r.URL.Path)

		// If requesting HTML or the root path, prevent browser caching so new builds are immediately visible
		if filepath.Ext(r.URL.Path) == ".html" || r.URL.Path == "/" {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
		}

		if _, err := os.Stat(filePath); os.IsNotExist(err) || r.URL.Path == "/" {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			http.ServeFile(w, r, filepath.Join(filesDir, "index.html"))
			return
		}

		http.FileServer(http.Dir(filesDir)).ServeHTTP(w, r)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server is running on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
