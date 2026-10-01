package middleware

import (
	"crypto/subtle"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ── Security Headers ────────────────────────────────────────────────
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		// CSP: semua resource dari origin sendiri; inline script/handler
		// diizinkan (MPA legacy memakai 53 onclick= + <script> inline),
		// eksternal dibatasi hanya unpkg (lucide) + Google Fonts.
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		next.ServeHTTP(w, r)
	})
}

// ── CSRF Protection (Double-Submit Cookie) ──────────────────────────
func CSRFProtect(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Safe methods bypass CSRF check
		if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" {
			next.ServeHTTP(w, r)
			return
		}

		// Check Origin header — allow same-origin and trusted domains
		origin := r.Header.Get("Origin")
		if origin != "" {
			host := r.Host
			allowed := []string{
				"https://e-pesantren.app",
				"https://rezaulin.tech",
				"https://reviewtechno.me",
				"http://127.0.0.1:8080",
				"http://localhost:8080",
				"https://127.0.0.1:8080",
				"https://localhost:8080",
			}
			// HARUS exact match. Prefix match (strings.HasPrefix) membuat
			// https://reviewtechno.me.attacker.com diterima sebagai sah.
			originAllowed := false
			for _, a := range allowed {
				if origin == a {
					originAllowed = true
					break
				}
			}
			// Same-origin: bandingkan HOST persis, bukan prefix.
			// sebelumnya: strings.HasPrefix(originHost, host) — menerima
			// subdomain penyerang yang berawalan sama.
			if !originAllowed && host != "" {
				if originHostOf(origin) != "" && originHostOf(origin) == hostOf(host) {
					originAllowed = true
				}
			}
			if !originAllowed {
				http.Error(w, "Forbidden: invalid origin", http.StatusForbidden)
				return
			}
		}

		// CSRF token validation — WAJIB, bukan fail-open.
		// Sebelumnya kedua kondisi di bawah ini memanggil next.ServeHTTP()
		// (lolos) sehingga token CSRF praktis tidak pernah diperiksa.
		csrfCookie, err := r.Cookie("csrf_token")
		if err != nil || csrfCookie.Value == "" {
			http.Error(w, "Forbidden: CSRF token missing", http.StatusForbidden)
			return
		}
		csrfHeader := r.Header.Get("X-CSRF-Token")
		if csrfHeader == "" {
			http.Error(w, "Forbidden: CSRF token missing", http.StatusForbidden)
			return
		}
		if subtle.ConstantTimeCompare([]byte(csrfCookie.Value), []byte(csrfHeader)) != 1 {
			http.Error(w, "Forbidden: CSRF token mismatch", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// hostOf menormalkan host (URL/Origin/host header) menjadi hostname+port
// opsional tanpa skema, dan membuang port default 80/443.
func hostOf(s string) string {
	s = strings.TrimPrefix(strings.TrimPrefix(s, "https://"), "http://")
	if i := strings.IndexAny(s, "/?#"); i >= 0 {
		s = s[:i]
	}
	s = strings.TrimSuffix(s, ":443")
	s = strings.TrimSuffix(s, ":80")
	return strings.ToLower(s)
}

// originHostOf mengambil host dari header Origin. Mengembalikan string kosong
// bila Origin tidak valid (mis. "null" dari sandboxed iframe) sehingga tidak
// pernah dianggap cocok.
func originHostOf(origin string) string {
	if origin == "" || origin == "null" {
		return ""
	}
	return hostOf(origin)
}

// ── Rate Limiter ────────────────────────────────────────────────────
type rateLimiter struct {
	mu       sync.Mutex
	clients  map[string]*rateEntry
	window   time.Duration
	maxReqs  int
	banAfter int
}

type rateEntry struct {
	count    int
	banned   bool
	bannedAt time.Time
	resetAt  time.Time
}

var LoginLimiter = &rateLimiter{
	clients:  make(map[string]*rateEntry),
	window:   15 * time.Minute,
	maxReqs:  10,
	banAfter: 20,
}

func (rl *rateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	entry, exists := rl.clients[key]
	if !exists {
		rl.clients[key] = &rateEntry{count: 1, resetAt: now.Add(rl.window)}
		return true
	}

	// Check if banned
	if entry.banned {
		if now.Sub(entry.bannedAt) > 1*time.Hour {
			entry.banned = false
			entry.count = 0
			entry.resetAt = now.Add(rl.window)
			return true
		}
		return false
	}

	// Check if window expired
	if now.After(entry.resetAt) {
		entry.count = 1
		entry.resetAt = now.Add(rl.window)
		return true
	}

	entry.count++
	if entry.count > rl.banAfter {
		entry.banned = true
		entry.bannedAt = now
		return false
	}
	return entry.count <= rl.maxReqs
}

// Cleanup runs periodically to remove stale entries
func (rl *rateLimiter) Cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	for k, v := range rl.clients {
		if now.After(v.resetAt) && (!v.banned || now.Sub(v.bannedAt) > 1*time.Hour) {
			delete(rl.clients, k)
		}
	}
}

func init() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			LoginLimiter.Cleanup()
		}
	}()
}

// clientIP mengembalikan IP klien yang STABIL untuk rate limiting.
//
// AKAR MASALAH (dibuktikan empiris): versi lama memakai seluruh nilai
// X-Forwarded-For sebagai key. nginx memakai `proxy_set_header X-Forwarded-For
// $proxy_add_x_forwarded_for` sehingga IP edge Cloudflare menempel di akhir
// header — dan edge-nya BERBEDA tiap request (tercatat: 162.158.88.129,
// 172.70.142.183, 172.69.176.82, 162.159.98.25 dalam 5 request dari klien
// yang sama). Key jadi selalu unik -> counter tak pernah terkumpul -> rate
// limit tidak pernah membatasi (75+ percobaan login, NOL respons 429).
func clientIP(r *http.Request) string {
	// Cloudflare MENIMPA header ini dengan IP asli klien, jadi tidak bisa
	// dipalsukan selama traffic melewati Cloudflare.
	if cf := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); cf != "" {
		if net.ParseIP(cf) != nil {
			return cf
		}
	}
	// X-Forwarded-For: pakai IP PERTAMA yang valid. Tiap proxy menambahkan
	// miliknya di akhir, sehingga yang pertama = klien asli.
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for _, part := range strings.Split(xff, ",") {
			p := strings.TrimSpace(part)
			if net.ParseIP(p) != nil {
				return p
			}
		}
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

// GlobalLoginLimiter adalah jaring pengaman: membatasi TOTAL percobaan login
// per menit tanpa peduli IP. Menutup celah bila header IP dipalsukan atau IP
// tidak stabil, sehingga brute-force tetap terhambat meski key per-IP bermasalah.
var GlobalLoginLimiter = &rateLimiter{
	clients:  make(map[string]*rateEntry),
	window:   1 * time.Minute,
	maxReqs:  60,
	banAfter: 120,
}

func RateLimitLogin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)

		if !LoginLimiter.Allow(ip) {
			log.Printf("[RATELIMIT] blokir per-IP ip=%s path=%s", ip, r.URL.Path)
			w.Header().Set("Retry-After", "900")
			http.Error(w, "Too many attempts. Try again later.", http.StatusTooManyRequests)
			return
		}
		if !GlobalLoginLimiter.Allow("global") {
			log.Printf("[RATELIMIT] blokir global ip=%s path=%s", ip, r.URL.Path)
			w.Header().Set("Retry-After", "60")
			http.Error(w, "Too many attempts. Try again later.", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── Password Complexity Validator ───────────────────────────────────
func ValidatePasswordComplexity(password string) (bool, string) {
	if len(password) < 8 {
		return false, "Password minimal 8 karakter"
	}
	var hasUpper, hasLower, hasDigit bool
	for _, c := range password {
		switch {
		case c >= 'A' && c <= 'Z':
			hasUpper = true
		case c >= 'a' && c <= 'z':
			hasLower = true
		case c >= '0' && c <= '9':
			hasDigit = true
		}
	}
	if !hasUpper {
		return false, "Password harus mengandung huruf besar"
	}
	if !hasLower {
		return false, "Password harus mengandung huruf kecil"
	}
	if !hasDigit {
		return false, "Password harus mengandung angka"
	}
	return true, ""
}

// ── Client Info Extractor (for session binding) ────────────────────
func ClientInfo(r *http.Request) (ip, ua string) {
	ip = r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
	}
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}
	ua = r.UserAgent()
	return
}
