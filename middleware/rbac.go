package middleware

import (
	"net/http"
)

// RequireRoles limits access to specific roles
func RequireRoles(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserContextKey).(UserSession)
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			isAllowed := false
			for _, userRole := range user.Roles {
				// Pimpinan has access to everything
				if userRole == "pimpinan" {
					isAllowed = true
					break
				}
				// Check if user's role is in the allowed list
				for _, role := range allowedRoles {
					if userRole == role {
						isAllowed = true
						break
					}
				}
				if isAllowed {
					break
				}
			}

			if !isAllowed {
				http.Error(w, "Forbidden: Insufficient privileges", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// DenyRoles blocks the listed roles from accessing a route while allowing every
// other authenticated user. Useful for endpoints that should be available to all
// staff but never to restricted roles such as wali_santri.
func DenyRoles(deniedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserContextKey).(UserSession)
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			isDenied := false
			for _, userRole := range user.Roles {
				for _, role := range deniedRoles {
					if userRole == role {
						isDenied = true
						break
					}
				}
				if isDenied {
					break
				}
			}

			// If pimpinan is in roles, bypass denial
			isPimpinan := false
			for _, userRole := range user.Roles {
				if userRole == "pimpinan" {
					isPimpinan = true
					break
				}
			}

			if isDenied && !isPimpinan {
				http.Error(w, "Forbidden: Insufficient privileges", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequirePasswordChanged middleware to force user to change password on first login
// Should be placed after RequireAuth
func RequirePasswordChanged(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := r.Context().Value(UserContextKey).(UserSession)
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Exclude the change-password endpoint itself from this check
		if r.URL.Path == "/api/change-password" {
			next.ServeHTTP(w, r)
			return
		}

		if !user.IsPasswordChanged {
			http.Error(w, "Please change your password first", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
