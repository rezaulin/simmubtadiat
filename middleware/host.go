package middleware

import (
	"context"
	"net"
	"net/http"
	"strings"
)

type ctxKey int

// CtxSectionSlug — key context berisi slug section yang sedang dirender
// pada subdomain (mis. "sejarah" untuk sejarah.<apex>).
const CtxSectionSlug ctxKey = 1

// HostRouter mendispatch request berdasarkan Host header:
//
//	apex / www / localhost / IP  -> next (aplikasi SIM, seperti sebelumnya)
//	app.<apex>                   -> next (SIM; target APK native, v1)
//	<slug>.<apex> path "/"       -> onSection (render halaman CMS)
//	<slug>.<apex> path lain      -> next (aset: /assets/*, /uploads/*,
//	                                /favicon.ico, /sw.js — harus dilayani
//	                                static handler, BUKAN dirender HTML)
//	<label>.<apex> tak dikenal   -> 404
//
// lookup dipanggil hanya untuk path "/"; implementasinya nil-safe
// (models.LookupSubdomain) supaya DB gagal saat boot tidak jadi panic.
func HostRouter(apex string, lookup func(label string) (string, bool), onSection http.HandlerFunc) func(http.Handler) http.Handler {
	apex = strings.ToLower(strings.TrimSpace(apex))
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			host := r.Host
			if h, _, err := net.SplitHostPort(host); err == nil {
				host = h
			}
			host = strings.ToLower(strings.TrimSpace(host))

			// Apex, www, localhost (dev/health-check), atau akses via IP:
			// aplikasi SIM melayani seperti sebelumnya.
			if host == apex || host == "www."+apex ||
				strings.HasPrefix(host, "localhost") || net.ParseIP(host) != nil {
				next.ServeHTTP(w, r)
				return
			}

			// Host di luar domain apex — biarkan aplikasi menangani.
			if !strings.HasSuffix(host, "."+apex) {
				next.ServeHTTP(w, r)
				return
			}

			label := strings.TrimSuffix(host, "."+apex)

			// app.<apex> = SIM (v1). Hanya "app" yang di-bypass; subdomain
			// section lain (termasuk "pendaftaran") tetap dirender CMS.
			if label == "app" {
				next.ServeHTTP(w, r)
				return
			}

			// Section subdomain: HANYA path "/" yang dirender sebagai
			// halaman CMS. Request aset (CSS/JS/gambar/favicon/sw.js)
			// tetap lanjut ke static handler supaya tidak ke-render HTML.
			if r.URL.Path != "/" {
				next.ServeHTTP(w, r)
				return
			}

			if slug, ok := lookup(label); ok {
				ctx := context.WithValue(r.Context(), CtxSectionSlug, slug)
				onSection(w, r.WithContext(ctx))
				return
			}

			http.NotFound(w, r)
		})
	}
}
