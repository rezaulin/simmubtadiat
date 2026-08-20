package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequireRoles(t *testing.T) {
	tests := []struct {
		name         string
		userRole     string
		allowedRoles []string
		expectedCode int
	}{
		{
			name:         "Admin/Pimpinan Has All Access",
			userRole:     "pimpinan",
			allowedRoles: []string{"pengajar"},
			expectedCode: http.StatusOK,
		},
		{
			name:         "Allowed Role",
			userRole:     "pengajar",
			allowedRoles: []string{"pengajar", "staf"},
			expectedCode: http.StatusOK,
		},
		{
			name:         "Forbidden Role",
			userRole:     "pengajar",
			allowedRoles: []string{"staf"},
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "No Role Provided in Context",
			userRole:     "",
			allowedRoles: []string{"pimpinan"},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := RequireRoles(tt.allowedRoles...)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}))

			req, _ := http.NewRequest("GET", "/", nil)

			if tt.name != "No Role Provided in Context" {
				// Inject UserSession into Context.
				// Middleware membaca user.Roles (slice) sejak migrasi multi-role (040),
				// jadi isi lewat Roles, bukan field Role lama.
				user := UserSession{Roles: []string{tt.userRole}}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				req = req.WithContext(ctx)
			}

			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)

			if rr.Code != tt.expectedCode {
				// wait, if "No Role Provided in Context", it should return 401 Unauthorized
				expected := tt.expectedCode
				if tt.name == "No Role Provided in Context" {
					expected = http.StatusUnauthorized
				}
				if rr.Code != expected {
					t.Errorf("expected %v, got %v", expected, rr.Code)
				}
			}
		})
	}
}

func TestRequirePasswordChanged(t *testing.T) {
	tests := []struct {
		name           string
		isChanged      bool
		path           string
		expectedCode   int
		expectNoContext bool
	}{
		{
			name:         "Password Changed",
			isChanged:    true,
			path:         "/api/some-route",
			expectedCode: http.StatusOK,
		},
		{
			name:         "Password Not Changed",
			isChanged:    false,
			path:         "/api/some-route",
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "Change Password Route Exception",
			isChanged:    false,
			path:         "/api/change-password",
			expectedCode: http.StatusOK,
		},
		{
			name:           "No Context",
			isChanged:      false,
			path:           "/api/some-route",
			expectedCode:   http.StatusUnauthorized,
			expectNoContext: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := RequirePasswordChanged(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}))

			req, _ := http.NewRequest("GET", tt.path, nil)

			if !tt.expectNoContext {
				user := UserSession{IsPasswordChanged: tt.isChanged}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				req = req.WithContext(ctx)
			}

			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)

			if rr.Code != tt.expectedCode {
				t.Errorf("expected %v, got %v", tt.expectedCode, rr.Code)
			}
		})
	}
}

// TestPenugasanRBAC mengunci kebijakan akses menu Penugasan (blok r.Route("/penugasan")
// di main.go). Peran "admin" TIDAK termasuk dalam cakupan Penugasan — baik untuk
// membaca daftar maupun mengelola (assign/hapus). pimpinan/mufatish/mustahiq
// mengikuti cakupannya masing-masing.
func TestPenugasanRBAC(t *testing.T) {
	// Role set harus cocok dengan yang dipakai di main.go.
	readRoles := []string{"pimpinan", "mufatish", "mustahiq"} // GET /api/penugasan
	manageRoles := []string{"pimpinan"}                       // assign & hapus penugasan

	tests := []struct {
		name         string
		roles        []string
		allowedRoles []string
		expectedCode int
	}{
		{"admin ditolak dari baca penugasan", []string{"admin"}, readRoles, http.StatusForbidden},
		{"admin ditolak dari kelola penugasan", []string{"admin"}, manageRoles, http.StatusForbidden},
		{"pimpinan boleh baca penugasan", []string{"pimpinan"}, readRoles, http.StatusOK},
		{"pimpinan boleh kelola penugasan", []string{"pimpinan"}, manageRoles, http.StatusOK},
		{"mufatish boleh baca penugasan", []string{"mufatish"}, readRoles, http.StatusOK},
		{"mustahiq boleh baca penugasan", []string{"mustahiq"}, readRoles, http.StatusOK},
		{"mufatish ditolak dari kelola penugasan", []string{"mufatish"}, manageRoles, http.StatusForbidden},
		// User multi-role: admin yang juga mufatish tetap lolos lewat peran mufatish.
		{"admin+mufatish boleh baca (via mufatish)", []string{"admin", "mufatish"}, readRoles, http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := RequireRoles(tt.allowedRoles...)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}))

			req, _ := http.NewRequest("GET", "/", nil)
			user := UserSession{Roles: tt.roles}
			ctx := context.WithValue(req.Context(), UserContextKey, user)
			req = req.WithContext(ctx)

			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)

			if rr.Code != tt.expectedCode {
				t.Errorf("%s: expected %d, got %d", tt.name, tt.expectedCode, rr.Code)
			}
		})
	}
}
