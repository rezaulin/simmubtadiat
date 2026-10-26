package middleware

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/mubtadiaat/app/config"
)

// ActivityLog mencatat aksi perubahan data (POST/PUT/DELETE/PATCH) pengguna
// terautentikasi ke tabel activity_log — audit trail (langkah B2.3, 26 Okt 2026).
//
// Desain:
//   - Hanya method mutasi; GET tidak dicatat (read-only).
//   - Ditulis async (goroutine + timeout 5s) agar latensi request tidak terdampak.
//   - Kegagalan pencatatan TIDAK boleh menggagalkan request — cukup log server.
//   - RequireAuth (middleware sebelumnya di chain) sudah menolak anonim sebelum
//     middleware ini jalan, jadi user pasti ada di context.
//
// Format action: "METHOD /api/segment" (dipotong 50 char, lebar kolom action).
// Kolom target = path penuh (dipotong 100), detail = {"status":<kode HTTP>}.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// requestIP menormalkan IP klien untuk kolom inet activity_log (27 Okt 2026).
// Sumber tunggal = clientIP() dari security.go (package sama):
// CF-Connecting-IP diprioritaskan (ditimpa Cloudflare, tak bisa dipalsukan),
// lalu X-Forwarded-For, lalu RemoteAddr. Nilai tak valid -> ditulis NULL.
func requestIP(r *http.Request) (string, bool) {
	if ip := clientIP(r); ip != "" && net.ParseIP(ip) != nil {
		return ip, true
	}
	return "", false
}

func ActivityLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch:
			// lanjut pencatatan
		default:
			next.ServeHTTP(w, r)
			return
		}

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		user, ok := r.Context().Value(UserContextKey).(UserSession)
		if !ok || config.DB == nil {
			return
		}

		action := r.Method + " " + r.URL.Path
		if len(action) > 50 {
			action = action[:50]
		}
		target := r.URL.Path
		if len(target) > 100 {
			target = target[:100]
		}
		ip, hasIP := requestIP(r)
		detail := fmt.Sprintf(`{"status":%d}`, rec.status)
		var ipArg interface{}
		if hasIP {
			ipArg = ip
		}

		go func(userID int, action, target, detail string, ipArg interface{}) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_, err := config.DB.Exec(ctx,
				`INSERT INTO activity_log (user_id, action, target, detail, ip_address)
				 VALUES ($1, $2, $3, $4::jsonb, $5)`,
				userID, action, target, detail, ipArg)
			if err != nil {
				log.Printf("[activity_log] gagal catat user=%d %s %s: %v", userID, action, target, err)
			}
		}(user.ID, action, target, detail, ipArg)
	})
}
