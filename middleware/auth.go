package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/mubtadiaat/app/config"
)

type contextKey string

const UserContextKey = contextKey("user")

type UserSession struct {
	ID                int
	Username          string
	Nama              string
	Role              string
	Roles             []string
	PengajarID        *int
	IsPasswordChanged bool
}

// HasRole checks if the user has a specific role
func (u UserSession) HasRole(role string) bool {
	for _, r := range u.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// RequireAuth ensures the user is logged in
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_id")
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var user UserSession
		var expiredAt time.Time

		// Join sessions and users tables
		err = config.DB.QueryRow(context.Background(),
			`SELECT u.id, u.username, u.nama, u.role, u.pengajar_id, u.is_password_changed, s.expired_at 
			 FROM sessions s 
			 JOIN users u ON s.user_id = u.id 
			 WHERE s.id = $1`,
			cookie.Value).Scan(&user.ID, &user.Username, &user.Nama, &user.Role, &user.PengajarID, &user.IsPasswordChanged, &expiredAt)

		if err != nil || expiredAt.Before(time.Now()) {
			// Clean up expired session
			if err == nil {
				config.DB.Exec(context.Background(), "DELETE FROM sessions WHERE id=$1", cookie.Value)
			}
			http.Error(w, "Session expired or invalid", http.StatusUnauthorized)
			return
		}

		// Fetch all roles for the user
		rows, err := config.DB.Query(context.Background(), "SELECT role FROM user_roles WHERE user_id = $1", user.ID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var r string
				if err := rows.Scan(&r); err == nil {
					user.Roles = append(user.Roles, r)
				}
			}
		}

		// If user_roles is empty (e.g., legacy or not yet migrated), fallback to primary role
		if len(user.Roles) == 0 && user.Role != "" {
			user.Roles = []string{user.Role}
		}

		// Refresh session expiry on each active request (§6.1 Panduan Kerja)
		newExpiry := time.Now().Add(8 * time.Hour)
		config.DB.Exec(context.Background(), "UPDATE sessions SET expired_at = $1 WHERE id = $2", newExpiry, cookie.Value)

		// Save user data in context
		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
