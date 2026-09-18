package middleware

import (
	"crypto/subtle"
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
			// Also allow same-origin (Origin matches Host)
			originAllowed := false
			for _, a := range allowed {
				if strings.HasPrefix(origin, a) {
					originAllowed = true
					break
				}
			}
			// Same-origin: Origin host == Request host
			if !originAllowed && host != "" {
				originHost := strings.TrimPrefix(strings.TrimPrefix(origin, "https://"), "http://")
				if strings.HasPrefix(originHost, host) || strings.HasPrefix(host, originHost) {
					originAllowed = true
				}
			}
			if !originAllowed {
				http.Error(w, "Forbidden: invalid origin", http.StatusForbidden)
				return
			}
		}

		// CSRF token validation
		csrfCookie, err := r.Cookie("csrf_token")
		if err != nil || csrfCookie.Value == "" {
			// No CSRF cookie — likely first request or cookie cleared, pass through
			next.ServeHTTP(w, r)
			return
		}
		csrfHeader := r.Header.Get("X-CSRF-Token")
		if csrfHeader == "" {
			// No header sent — frontend belum support, pass through for now
			next.ServeHTTP(w, r)
			return
		}
		if subtle.ConstantTimeCompare([]byte(csrfCookie.Value), []byte(csrfHeader)) != 1 {
			http.Error(w, "Forbidden: CSRF token mismatch", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
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

func RateLimitLogin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.Header.Get("X-Forwarded-For")
		if ip == "" {
			ip = r.RemoteAddr
		}
		// Strip port
		if idx := strings.LastIndex(ip, ":"); idx != -1 {
			ip = ip[:idx]
		}
		if !LoginLimiter.Allow(ip) {
			w.Header().Set("Retry-After", "900")
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
