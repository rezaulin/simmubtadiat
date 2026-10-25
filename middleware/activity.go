package middleware

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
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

// requestIP menormalkan IP klien: X-Forwarded-For hop pertama (di depan
// Cloudflare), lalu CF-Connecting-IP, lalu RemoteAddr. Nilai tak valid
// (header palsu dsb.) ditolak ParseIP → pemanggil menulis NULL.
func requestIP(r *http.Request) (string, bool) {
	candidates := make([]string, 0, 3)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for _, part := range strings.Split(xff, ",") {
			candidates = append(candidates, strings.TrimSpace(part))
		}
	}
	if cf := r.Header.Get("CF-Connecting-IP"); cf != "" {
		candidates = append(candidates, strings.TrimSpace(cf))
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		candidates = append(candidates, host)
	} else {
		candidates = append(candidates, r.RemoteAddr)
	}
	for _, c := range candidates {
		if ip := net.ParseIP(c); ip != nil {
			return c, true
		}
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
