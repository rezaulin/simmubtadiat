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

// writeJSON encodes v as JSON without HTML-escaping ' (apostrophe).
func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	enc.Encode(v)
}

func main() {
	// Initialize Database
	config.ConnectDB()

	r := chi.NewRouter()

	r.Use(appMiddleware.SecurityHeaders)
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
		// Public Routes (rate limited)
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RateLimitLogin)
			r.Post("/login", handlers.Login)
			r.Post("/login-wali", handlers.LoginWali)
		})
		// Protected Routes
		r.Group(func(r chi.Router) {
			r.Use(appMiddleware.RequireAuth)
			r.Use(appMiddleware.CSRFProtect)

			// Logout wajib lewat CSRF — sebelumnya di luar group (CSRF logout).
			r.Post("/logout", handlers.Logout)
			// Can change password without RequirePasswordChanged middleware blocking it
			r.Post("/change-password", handlers.ChangePassword)

			r.Group(func(r chi.Router) {
				r.Use(appMiddleware.RequirePasswordChanged)

				// Route per domain dipisah dari main.go ke routes_<domain>.go
				// (package yang sama) supaya gampang dilacak saat debugging:
				// cari nama file = cari domain fiturnya.
				registerAuthRoutes(r)
				registerAkademikRoutes(r)
				registerSantriRoutes(r)
				registerPengajarRoutes(r)
				registerAbsensiRoutes(r)
				registerPenilaianRoutes(r)
				registerCatatanRoutes(r)
				registerAlumniRoutes(r)
				registerUtilRoutes(r)
			}) // <-- Close r.Group for RequirePasswordChanged
		})
	}) // <-- Close /api route

	// Serve Static Files (Frontend)
	workDir, _ := os.Getwd()
	filesDir := filepath.Join(workDir, "public", "dist")

	// Create a catch-all route to serve static files or fallback to index.html for SPA routing
	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		filePath := filepath.Join(filesDir, r.URL.Path)

		// If requesting HTML, the service worker, or the root path, prevent
		// browser/CDN caching so new builds are immediately visible.
		// Also apply to hashed JS/CSS assets — Vite content-hash filenames
		// already bust caches, but Cloudflare's default max-age=14400 can
		// still serve stale bundles.  no-cache lets CF revalidate on every
		// request while still allowing the browser to use local copy when
		// the server responds 304.
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")

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
