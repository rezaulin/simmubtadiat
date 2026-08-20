package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/mubtadiaat/app/config"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginWaliRequest struct {
	Nik string `json:"nik"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

type AuthResponse struct {
	Status             string   `json:"status"`
	Message            string   `json:"message"`
	Role               string   `json:"role,omitempty"`
	Roles              []string `json:"roles,omitempty"`
	IsPasswordChanged  bool     `json:"is_password_changed"`
}

// Login handles user authentication
func Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Fetch user from DB
	var id int
	var hash, role string
	var isPasswordChanged bool

	err := config.DB.QueryRow(context.Background(),
		"SELECT id, password_hash, role, is_password_changed FROM users WHERE username=$1 AND is_active=true",
		req.Username).Scan(&id, &hash, &role, &isPasswordChanged)

	if err != nil {
		// To prevent timing attacks, we should still compare a dummy hash or just return generic error
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Fetch all roles for the user
	var roles []string
	rows, err := config.DB.Query(context.Background(), "SELECT role FROM user_roles WHERE user_id = $1", id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var r string
			if err := rows.Scan(&r); err == nil {
				roles = append(roles, r)
			}
		}
	}
	if len(roles) == 0 && role != "" {
		roles = []string{role}
	}

	// Create Session
	sessionID := uuid.New().String()
	expires := time.Now().Add(24 * time.Hour) // 1 day session

	_, err = config.DB.Exec(context.Background(),
		"INSERT INTO sessions (id, user_id, expired_at) VALUES ($1, $2, $3)",
		sessionID, id, expires)
	
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Set Cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		Expires:  expires,
		HttpOnly: true,
		Secure:   false, // Set to false to allow login over HTTP on LAN
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
	})

	json.NewEncoder(w).Encode(AuthResponse{
		Status:            "success",
		Message:           "Login successful",
		Role:              role,
		Roles:             roles,
		IsPasswordChanged: isPasswordChanged,
	})
}

// Logout removes the session
func Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_id")
	if err == nil {
		// Delete from DB
		config.DB.Exec(context.Background(), "DELETE FROM sessions WHERE id=$1", cookie.Value)
	}

	// Clear Cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    "",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
	})

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Logged out"})
}

// LoginWali handles login for Wali Santri using NIK
func LoginWali(w http.ResponseWriter, r *http.Request) {
	var req LoginWaliRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Fetch santri by NIK to ensure it exists
	var santriID int
	var santriNama string
	err := config.DB.QueryRow(context.Background(),
		"SELECT id, nama FROM santri WHERE nik=$1 AND status='aktif'",
		req.Nik).Scan(&santriID, &santriNama)

	if err != nil {
		http.Error(w, "Invalid NIK or Santri is not active", http.StatusUnauthorized)
		return
	}

	// We create a session for wali_santri, checking if user exists or we create one on the fly.
	// PANDUAN_KERJA: "username=NIK, password awal=NIK, wajib ganti password"
	var userID int
	var hash, role string
	var isPasswordChanged bool

	err = config.DB.QueryRow(context.Background(),
		"SELECT id, password_hash, role, is_password_changed FROM users WHERE username=$1",
		req.Nik).Scan(&userID, &hash, &role, &isPasswordChanged)
	
	if err != nil {
		// User doesn't exist, create it on the fly
		newHash, _ := bcrypt.GenerateFromPassword([]byte(req.Nik), 12)
		err = config.DB.QueryRow(context.Background(),
			`INSERT INTO users (username, password_hash, role, nama, is_password_changed, is_active)
			 VALUES ($1, $2, 'wali_santri', $3, false, true) RETURNING id`,
			req.Nik, string(newHash), "Wali "+santriNama).Scan(&userID)
		if err != nil {
			http.Error(w, "Internal server error creating wali account", http.StatusInternalServerError)
			return
		}
		
		// Link it in wali_santri_link table
		_, err = config.DB.Exec(context.Background(),
			`INSERT INTO wali_santri_link (user_id, santri_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			userID, santriID)
		
		if err != nil {
			http.Error(w, "Internal server error linking santri", http.StatusInternalServerError)
			return
		}

		hash = string(newHash)
		role = "wali_santri"
		isPasswordChanged = false
	}

	// For first time, or if they haven't changed password, they login directly with NIK (or if they changed, they should use standard login instead, but let's allow LoginWali if password hasn't been changed)
	if isPasswordChanged {
		// If password has been changed, they MUST use the standard /api/auth/login endpoint
		// but if we want to allow them here as well, we would need their password. Since LoginWali only takes NIK, we must reject if password is changed.
		http.Error(w, "Sandi telah diubah. Gunakan form login standar.", http.StatusUnauthorized)
		return
	}

	// Fetch all roles for the user (in case they have multiple)
	var roles []string
	rows, err := config.DB.Query(context.Background(), "SELECT role FROM user_roles WHERE user_id = $1", userID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var r string
			if err := rows.Scan(&r); err == nil {
				roles = append(roles, r)
			}
		}
	}
	if len(roles) == 0 && role != "" {
		roles = []string{role}
	}

	// Create Session
	sessionID := uuid.New().String()
	expires := time.Now().Add(24 * time.Hour) // 1 day session

	_, err = config.DB.Exec(context.Background(),
		"INSERT INTO sessions (id, user_id, expired_at) VALUES ($1, $2, $3)",
		sessionID, userID, expires)
	
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		Expires:  expires,
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
	})

	json.NewEncoder(w).Encode(AuthResponse{
		Status:            "success",
		Message:           "Login successful",
		Role:              role,
		Roles:             roles,
		IsPasswordChanged: isPasswordChanged,
	})
}

// ChangePassword allows an authenticated user to change their password
func ChangePassword(w http.ResponseWriter, r *http.Request) {
	// We extract session token manually since this is before RequirePasswordChanged middleware or called specifically
	cookie, err := r.Cookie("session_id")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var userID int
	err = config.DB.QueryRow(context.Background(),
		"SELECT user_id FROM sessions WHERE id=$1 AND expired_at > NOW()", cookie.Value).Scan(&userID)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Verify old password
	var hash string
	err = config.DB.QueryRow(context.Background(),
		"SELECT password_hash FROM users WHERE id=$1", userID).Scan(&hash)
	if err != nil {
		http.Error(w, "User not found", http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.OldPassword)); err != nil {
		http.Error(w, "Password lama salah", http.StatusBadRequest)
		return
	}

	// Hash new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	// Update DB
	_, err = config.DB.Exec(context.Background(),
		"UPDATE users SET password_hash=$1, is_password_changed=true WHERE id=$2", string(newHash), userID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
		"message": "Password berhasil diubah",
	})
}
