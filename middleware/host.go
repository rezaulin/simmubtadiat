package middleware

import (
	"context"
	"io"
	"net"
	"net/http"
	"strings"
)

type ctxKey int

// CtxSectionSlug — key context berisi slug section yang sedang dirender
// pada subdomain (mis. "sejarah" untuk sejarah.<apex>).
const CtxSectionSlug ctxKey = 1

// killSwitchSW — service worker "pemutus" untuk apex.
//
// Sebelum landing pindah ke apex, aplikasi SIM (SPA) terpasang di apex dan
// mendaftarkan service worker ber-scope "/". SW lama itu akan terus menyajikan
// shell aplikasi dari cache walau server sudah mengirim landing page. SW ini
// di-serve di /sw.js apex: saat browser melakukan update-check, SW baru
// mengambil alih, menghapus semua cache, membatalkan registrasi, lalu memuat
// ulang tab. Tidak ada fetch handler -> setelah unregister semua navigasi
// langsung ke network (landing page).
const killSwitchSW = `self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    try {
      var list = await self.clients.matchAll({ type: 'window' });
      list.forEach(function (c) { c.navigate(c.url); });
    } catch (e) {}
  })());
});
`

// HostRouter mendispatch request berdasarkan Host header.
//
//	localhost / IP                    -> next (health check internal, SIM)
//	app.<apex>                        -> next (aplikasi SIM penuh: login, dashboard)
//	<apex> / www.<apex>:
//	    "/" | "/index.html"           -> onHome (landing page)
//	    "/p/{slug}"                   -> next (halaman section, URL kanonik)
//	    "/api/*"                      -> next (API landing + API app)
//	    "/sw.js"                      -> killSwitchSW (lepas SW lama di apex)
//	    "/landing"                    -> 301 ke "/"
//	    path lain (aplikasi)          -> 301 ke https://app.<apex><path>
//	<slug>.<apex> path "/"            -> onSection (halaman CMS)
//	<slug>.<apex> path lain           -> next (aset: /assets/*, /uploads/*, ...)
//	<label>.<apex> tak dikenal        -> 404
//
// lookup dipanggil hanya untuk path "/"; implementasinya nil-safe
// (models.LookupSubdomain) supaya DB gagal saat boot tidak jadi panic.
func HostRouter(apex string, lookup func(label string) (string, bool), onSection, onHome http.HandlerFunc) func(http.Handler) http.Handler {
	apex = strings.ToLower(strings.TrimSpace(apex))
	appHost := "app." + apex
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			host := r.Host
			if h, _, err := net.SplitHostPort(host); err == nil {
				host = h
			}
			host = strings.ToLower(strings.TrimSpace(host))
			path := r.URL.Path

			// localhost (dev/health-check) atau akses via IP: SIM langsung.
			if strings.HasPrefix(host, "localhost") || net.ParseIP(host) != nil {
				next.ServeHTTP(w, r)
				return
			}

			// Host di luar domain apex — biarkan aplikasi menangani.
			if host != apex && !strings.HasSuffix(host, "."+apex) {
				next.ServeHTTP(w, r)
				return
			}

			// app.<apex> = aplikasi SIM penuh (login, dashboard, PWA).
			if host == appHost {
				next.ServeHTTP(w, r)
				return
			}

			// Apex / www: landing page + redirect path aplikasi ke app.<apex>.
			if host == apex || host == "www."+apex {
				switch {
				case path == "/sw.js":
					w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
					w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
					io.WriteString(w, killSwitchSW)
				case strings.HasPrefix(path, "/api/"):
					next.ServeHTTP(w, r)
				case path == "/" || path == "/index.html":
					onHome(w, r)
				case strings.HasPrefix(path, "/p/"):
					next.ServeHTTP(w, r)
				case path == "/berita", strings.HasPrefix(path, "/berita/"):
					// Berita pesantren (daftar + detail) hidup di apex.
					next.ServeHTTP(w, r)
				case strings.HasPrefix(path, "/uploads/"), strings.HasPrefix(path, "/media/"), path == "/favicon.ico", path == "/favicon.svg":
					// Aset gambar (foto section, logo) tetap dilayani app di apex.
					next.ServeHTTP(w, r)
				case path == "/landing":
					http.Redirect(w, r, "/", http.StatusMovedPermanently)
				default:
					target := "https://" + appHost + path
					if r.URL.RawQuery != "" {
						target += "?" + r.URL.RawQuery
					}
					http.Redirect(w, r, target, http.StatusMovedPermanently)
				}
				return
			}

			// Section subdomain: HANYA path "/" yang dirender sebagai halaman
			// CMS. Request aset (CSS/JS/gambar/favicon/sw.js) tetap lanjut ke
			// static handler supaya tidak ke-render HTML.
			if path != "/" {
				next.ServeHTTP(w, r)
				return
			}

			label := strings.TrimSuffix(host, "."+apex)
			if slug, ok := lookup(label); ok {
				ctx := context.WithValue(r.Context(), CtxSectionSlug, slug)
				onSection(w, r.WithContext(ctx))
				return
			}

			http.NotFound(w, r)
		})
	}
}
