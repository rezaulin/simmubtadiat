package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

// newPengabdianRouter builds a chi router that mirrors the exact RBAC wiring of
// the /api/pengabdian route group registered in main.go:
//
//	r.Route("/pengabdian", func(r chi.Router) {
//	    r.Group(func(r chi.Router) {
//	        r.Use(appMiddleware.RequireRoles("pimpinan", "admin"))
//	        r.Post("/mulai", handlers.MulaiPengabdian)
//	        r.Post("/selesai", handlers.SelesaiPengabdian)
//	    })
//	    r.Group(func(r chi.Router) {
//	        r.Use(appMiddleware.RequireRoles("pimpinan", "admin", "mufatish"))
//	        r.Get("/", handlers.GetPengabdian)
//	    })
//	})
//
// RBAC is enforced before the handler runs, so we substitute lightweight dummy
// handlers that return 200. This lets us assert the access-control decision
// (allow vs 401/403) without needing a database.
func newPengabdianRouter() http.Handler {
	ok := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}

	r := chi.NewRouter()
	r.Route("/pengabdian", func(r chi.Router) {
		// Peran_Tulis: only pimpinan & admin may perform write actions.
		r.Group(func(r chi.Router) {
			r.Use(RequireRoles("pimpinan", "admin"))
			r.Post("/mulai", ok)
			r.Post("/selesai", ok)
		})
		// Peran_Baca: pimpinan, admin & mufatish may read.
		r.Group(func(r chi.Router) {
			r.Use(RequireRoles("pimpinan", "admin", "mufatish"))
			r.Get("/", ok)
		})
	})
	return r
}

// doRequest sends a request through the router, optionally injecting an
// authenticated UserSession with the given role into the request context.
// An empty role means "no authenticated session" (unauthenticated request).
func doRequest(handler http.Handler, method, target, role string) int {
	req, _ := http.NewRequest(method, target, nil)
	if role != "" {
		user := UserSession{Role: role, IsPasswordChanged: true}
		ctx := context.WithValue(req.Context(), UserContextKey, user)
		req = req.WithContext(ctx)
	}
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	return rr.Code
}

func is2xx(code int) bool { return code >= 200 && code < 300 }

func isDenied(code int) bool {
	return code == http.StatusUnauthorized || code == http.StatusForbidden
}

// TestPengabdianRBAC verifies role-based access control on the /api/pengabdian
// route group.
//
// Validates: Requirements 9.1, 9.2, 9.3
func TestPengabdianRBAC(t *testing.T) {
	router := newPengabdianRouter()

	writeEndpoints := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/pengabdian/mulai"},
		{http.MethodPost, "/pengabdian/selesai"},
	}

	// Requirement 9.1: Peran_Tulis (pimpinan/admin) is allowed on write endpoints.
	t.Run("Peran_Tulis allowed on write endpoints (Req 9.1)", func(t *testing.T) {
		for _, role := range []string{"pimpinan", "admin"} {
			for _, ep := range writeEndpoints {
				code := doRequest(router, ep.method, ep.path, role)
				if !is2xx(code) {
					t.Errorf("role %q on %s %s: expected 2xx, got %d", role, ep.method, ep.path, code)
				}
			}
		}
	})

	// Requirement 9.2: any role other than Peran_Tulis is rejected on write
	// endpoints with an unauthorized status (401/403).
	t.Run("Non-write roles rejected on write endpoints (Req 9.2)", func(t *testing.T) {
		for _, role := range []string{"mufatish", "mustahiq", "munawwib", "wali_santri"} {
			for _, ep := range writeEndpoints {
				code := doRequest(router, ep.method, ep.path, role)
				if !isDenied(code) {
					t.Errorf("role %q on %s %s: expected 401/403, got %d", role, ep.method, ep.path, code)
				}
			}
		}
	})

	// Requirement 9.2 (unauthenticated): no session → 401.
	t.Run("Unauthenticated rejected on write endpoints (Req 9.2)", func(t *testing.T) {
		for _, ep := range writeEndpoints {
			code := doRequest(router, ep.method, ep.path, "")
			if code != http.StatusUnauthorized {
				t.Errorf("unauthenticated on %s %s: expected 401, got %d", ep.method, ep.path, code)
			}
		}
	})

	// Requirement 9.3: Peran_Baca (pimpinan/admin/mufatish) allowed on GET.
	t.Run("Peran_Baca allowed on GET (Req 9.3)", func(t *testing.T) {
		for _, role := range []string{"pimpinan", "admin", "mufatish"} {
			code := doRequest(router, http.MethodGet, "/pengabdian/", role)
			if !is2xx(code) {
				t.Errorf("role %q on GET /pengabdian/: expected 2xx, got %d", role, code)
			}
		}
	})

	// Requirement 9.2/9.3 boundary: a role outside Peran_Baca is rejected on GET.
	t.Run("Non-read roles rejected on GET (Req 9.2/9.3)", func(t *testing.T) {
		for _, role := range []string{"mustahiq", "munawwib", "wali_santri"} {
			code := doRequest(router, http.MethodGet, "/pengabdian/", role)
			if !isDenied(code) {
				t.Errorf("role %q on GET /pengabdian/: expected 401/403, got %d", role, code)
			}
		}
	})
}
