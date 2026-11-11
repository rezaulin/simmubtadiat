package handlers

import (
	"encoding/json"
	"errors"
	"html/template"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// Dua set terpisah: base.html diparse ulang per-page supaya
// {{define "content"}} di section.html dan home.html tidak saling
// menimpa (dalam satu set, definisi terakhir yang menang).
// landingFuncs — helper template landing (nomor kartu mulai dari 1).
var landingFuncs = template.FuncMap{
	"add1": func(i int) int { return i + 1 },
	// sub1 — nomor halaman sebelumnya di paginasi berita.
	"sub1": func(i int) int { return i - 1 },
	// menuLabel — label pendek untuk menu header. Judul lengkap terlalu panjang
	// untuk bar horizontal ("Visi, Misi & Masayikh" -> "Pengasuh").
	"menuLabel": func(slug, judul string) string {
		switch strings.ToLower(slug) {
		case "sejarah":
			return "Profil"
		case "pengasuh":
			return "Pengasuh"
		case "pendidikan":
			return "Pendidikan"
		case "fasilitas":
			return "Fasilitas"
		case "prestasi":
			return "Prestasi"
		case "pendaftaran":
			return "Pendaftaran"
		}
		return judul
	},
	// ringkas — potong deskripsi kartu di batas kata, jangan potong tengah kata.
	"ringkas": func(s string, n int) string {
		r := []rune(s)
		if len(r) <= n {
			return s
		}
		cut := string(r[:n])
		if i := strings.LastIndex(cut, " "); i > 0 {
			cut = cut[:i]
		}
		return strings.TrimRight(cut, " ,.;:—–-") + "…"
	},
	// icon — ikon garis untuk kartu portal di beranda, dipilih dari slug.
	// Tanpa data ikon di DB, pemetaan keyword ini yang bikin tiap kartu
	// punya penanda visual sendiri (bukan kotak kosong seragam).
	"icon": func(slug string) template.HTML {
		s := strings.ToLower(slug)
		pick := func(keys ...string) bool {
			for _, k := range keys {
				if strings.Contains(s, k) {
					return true
				}
			}
			return false
		}
		var body string
		switch {
		case pick("sejarah", "profil", "tentang"):
			body = `<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>`
		case pick("pengasuh", "visi", "masayikh", "guru", "ustadz"):
			body = `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`
		case pick("pendidikan", "kurikulum", "jenjang", "akademik"):
			body = `<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>`
		case pick("fasilitas", "sarana", "asrama", "gedung"):
			body = `<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/>`
		case pick("prestasi", "alumni", "penghargaan"):
			body = `<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5"/>`
		case pick("pendaftaran", "ppdb", "psb", "daftar"):
			body = `<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h6"/>`
		default:
			body = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/>`
		}
		return template.HTML(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">` + body + `</svg>`)
	},
	// initials — inisial 2 kata pertama untuk monogram (mis. "Pesantren
	// Mubtadiat Lirboyo" -> "PM"). Dipakai saat logo_url belum diisi.
	"initials": func(s string) string {
		var out []rune
		for _, w := range strings.Fields(s) {
			if len(out) == 2 {
				break
			}
			r := []rune(w)
			if len(r) == 0 {
				continue
			}
			out = append(out, []rune(strings.ToUpper(string(r[0])))...)
		}
		return string(out)
	},
}

var landingTmplSection = template.Must(template.New("section.html").Funcs(landingFuncs).ParseFiles(
	"templates/landing/base.html",
	"templates/landing/section.html",
))

var landingTmplHome = template.Must(template.New("home.html").Funcs(landingFuncs).ParseFiles(
	"templates/landing/base.html",
	"templates/landing/home.html",
))

var landingTmplNewsIndex = template.Must(template.New("news_index.html").Funcs(landingFuncs).ParseFiles(
	"templates/landing/base.html",
	"templates/landing/news_index.html",
))

var landingTmplNewsDetail = template.Must(template.New("news_detail.html").Funcs(landingFuncs).ParseFiles(
	"templates/landing/base.html",
	"templates/landing/news_detail.html",
))

var landingApex string

// SetLandingApex — dipanggil main saat boot; domain apex dipakai untuk
// canonical tag dan link absolut di template landing.
func SetLandingApex(apex string) {
	landingApex = apex
}

var slugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)

var settingKeyRe = regexp.MustCompile(`^[a-z0-9_]{1,64}$`)

// LandingPageData — data yang diterima template landing.
type LandingPageData struct {
	Judul           string
	MetaTitle       string
	MetaDescription string
	Canonical       string
	OgImage         string
	KontenHTML      template.HTML
	Sections        []models.LandingSection
	Settings        map[string]string
	SiteName        string
	Apex            string
	AppURL          string
	Year            int
	// Berita (portal + /berita)
	NewsHeadline     *NewsView
	NewsList         []NewsView
	NewsDetail       *NewsView
	NewsKategori     string
	NewsKategoriList []KategoriView
	NewsPage         int
	NewsPages        int
	NewsTotal        int
}

func landingBaseData() LandingPageData {
	settings := models.LandingSettings()
	sections, _ := models.ListSections(true)
	menu := make([]models.LandingSection, 0, len(sections))
	for _, s := range sections {
		if s.TampilDiMenu {
			menu = append(menu, s)
		}
	}
	siteName := settings["site_name"]
	if siteName == "" {
		siteName = landingApex
	}
	return LandingPageData{
		Sections: menu,
		Settings: settings,
		SiteName: siteName,
		Apex:     landingApex,
		AppURL:   "https://app." + landingApex,
		Year:     time.Now().Year(),
	}
}

func renderLanding(w http.ResponseWriter, name string, data LandingPageData) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	tmpl := landingTmplSection
	switch name {
	case "home.html":
		tmpl = landingTmplHome
	case "news_index.html":
		tmpl = landingTmplNewsIndex
	case "news_detail.html":
		tmpl = landingTmplNewsDetail
	}
	if err := tmpl.ExecuteTemplate(w, name, data); err != nil {
		log.Printf("[LANDING] render %s gagal: %v", name, err)
		http.Error(w, "gagal render halaman", http.StatusInternalServerError)
	}
}

func fillSectionData(data *LandingPageData, sec *models.LandingSection) {
	data.Judul = sec.Judul
	data.MetaTitle = sec.MetaTitle
	data.MetaDescription = sec.MetaDescription
	if sec.OGImage != "" && ogImageValid(sec.OGImage) {
		if strings.HasPrefix(sec.OGImage, "/") {
			data.OgImage = "https://" + landingApex + sec.OGImage
		} else {
			data.OgImage = sec.OGImage
		}
	}
	// Sanitasi ulang saat render (defense in depth).
	data.KontenHTML = template.HTML(models.SanitizeLandingHTML(sec.KontenHTML))
}

// ServeSectionBySubdomain — dipanggil HostRouter untuk <slug>.<apex>/ .
func ServeSectionBySubdomain(w http.ResponseWriter, r *http.Request) {
	slug, _ := r.Context().Value(appMiddleware.CtxSectionSlug).(string)
	sec, err := models.GetSectionBySlug(slug, true)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	data := landingBaseData()
	fillSectionData(&data, sec)
	// Canonical ke subpath: otoritas SEO terkonsentrasi di apex.
	data.Canonical = "https://" + landingApex + "/p/" + sec.Slug
	renderLanding(w, "section.html", data)
}

// ServeSectionBySlug — /p/{slug} di apex (URL kanonik section).
func ServeSectionBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	sec, err := models.GetSectionBySlug(slug, true)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	data := landingBaseData()
	fillSectionData(&data, sec)
	data.Canonical = "https://" + landingApex + "/p/" + sec.Slug
	renderLanding(w, "section.html", data)
}

// LandingHome — /landing: pratinjau beranda (hero + daftar section +
// footer). Jadi template saat apex di-flip ke landing nanti.
func LandingHome(w http.ResponseWriter, r *http.Request) {
	data := landingBaseData()
	data.Judul = "Beranda"
	data.MetaTitle = data.SiteName
	if tag := data.Settings["site_tagline"]; tag != "" {
		data.MetaTitle = data.SiteName + " — " + tag
	}
	data.MetaDescription = data.Settings["seo_description"]
	data.Canonical = "https://" + landingApex + "/"
	// Berita terbaru: 1 utama + 3 kartu. Kalau belum ada berita published,
	// blok berita tidak dirender sama sekali (template pakai {{if}}).
	if hl, rest := models.HomeNews(4); hl != nil {
		v := newsView(hl)
		data.NewsHeadline = &v
		data.NewsList = newsViews(rest)
	}
	renderLanding(w, "home.html", data)
}

// ---- API publik ----

// APILandingSections — daftar section published (JSON).
func APILandingSections(w http.ResponseWriter, r *http.Request) {
	sections, err := models.ListSections(true)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		writeJSON(w, map[string]string{"error": "gagal memuat section"})
		return
	}
	writeJSON(w, sections)
}

// APILandingSettings — settings situs (JSON).
func APILandingSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := models.ListSettings()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		writeJSON(w, map[string]string{"error": "gagal memuat settings"})
		return
	}
	writeJSON(w, settings)
}

// ---- API admin (pimpinan) ----

// AdminListSections — semua section (termasuk draft).
func AdminListSections(w http.ResponseWriter, r *http.Request) {
	sections, err := models.ListSections(false)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		writeJSON(w, map[string]string{"error": "gagal memuat section"})
		return
	}
	writeJSON(w, sections)
}

// AdminGetSettings — semua settings dengan label/grup (form editor).
func AdminGetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := models.ListSettings()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		writeJSON(w, map[string]string{"error": "gagal memuat settings"})
		return
	}
	writeJSON(w, settings)
}

type sectionPayload struct {
	Slug            string  `json:"slug"`
	Subdomain       *string `json:"subdomain"`
	Judul           string  `json:"judul"`
	KontenHTML      string  `json:"konten_html"`
	MetaTitle       string  `json:"meta_title"`
	MetaDescription string  `json:"meta_description"`
	OGImage         string  `json:"og_image"`
	Urutan          int     `json:"urutan"`
	TampilDiMenu    bool    `json:"tampil_di_menu"`
	IsPublished     bool    `json:"is_published"`
}

func currentUserID(r *http.Request) int {
	if user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession); ok {
		return user.ID
	}
	return 0
}

func landingErr(w http.ResponseWriter, status int, msg string) {
	w.WriteHeader(status)
	writeJSON(w, map[string]string{"error": msg})
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "duplicate key")
}

// landingMaxBodyBytes — batas body JSON admin landing. Konten terpanjang
// saat ini ~2,6 KB, jadi 2 MB masih ~800x lipat; upload foto punya jalur
// sendiri (4 MB di landing_upload.go) dan tidak terpengaruh batas ini.
const landingMaxBodyBytes = 2 << 20

// decodeBodyLimited — decode JSON dengan batas ukuran body. Balas 413
// dengan pesan jelas (bukan error kosong) kalau body melebihi batas.
func decodeBodyLimited(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, landingMaxBodyBytes)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			landingErr(w, http.StatusRequestEntityTooLarge, "payload terlalu besar (maksimal 2 MB) — sisipkan gambar lewat tombol Upload, bukan HTML/base64")
			return false
		}
		landingErr(w, http.StatusBadRequest, "payload tidak valid")
		return false
	}
	return true
}

// subdomainTerlarang — label yang dipakai infrastruktur. HostRouter
// memeriksa app.<apex> lebih dulu, tapi urutan dispatch bisa berubah;
// kalau itu terjadi, section dengan subdomain "app" akan menutupi aplikasi.
var subdomainTerlarang = map[string]bool{
	"app": true, "www": true, "api": true, "admin": true, "mail": true,
	"smtp": true, "imap": true, "pop": true, "pop3": true, "webmail": true,
	"ns1": true, "ns2": true, "ftp": true, "cdn": true, "static": true,
	"assets": true, "media": true, "uploads": true, "dev": true,
	"staging": true, "test": true, "panel": true, "dashboard": true,
	"status": true, "localhost": true,
}

// ogImageValid — hanya path relatif ("/...") atau URL http(s) absolut.
// Skema lain (javascript:, data:, vbscript:) ditolak supaya tidak masuk
// ke <meta property="og:image">. "//host" (protokol-relatif) juga ditolak
// karena menunjuk host luar.
func ogImageValid(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return true
	}
	if strings.HasPrefix(s, "//") {
		return false
	}
	if strings.HasPrefix(s, "/") {
		return true
	}
	ls := strings.ToLower(s)
	return strings.HasPrefix(ls, "https://") || strings.HasPrefix(ls, "http://")
}

// AdminCreateSection — POST /api/landing/admin/sections
func AdminCreateSection(w http.ResponseWriter, r *http.Request) {
	var p sectionPayload
	if !decodeBodyLimited(w, r, &p) {
		return
	}
	if !slugRe.MatchString(p.Slug) {
		landingErr(w, http.StatusBadRequest, "slug tidak valid (huruf kecil, angka, tanda hubung)")
		return
	}
	if strings.TrimSpace(p.Judul) == "" {
		landingErr(w, http.StatusBadRequest, "judul wajib diisi")
		return
	}
	if p.Subdomain != nil && *p.Subdomain != "" {
		if !slugRe.MatchString(*p.Subdomain) {
			landingErr(w, http.StatusBadRequest, "subdomain tidak valid")
			return
		}
		if subdomainTerlarang[*p.Subdomain] {
			landingErr(w, http.StatusBadRequest, "subdomain \""+*p.Subdomain+"\" dipakai sistem, pilih label lain")
			return
		}
	}
	if !ogImageValid(p.OGImage) {
		landingErr(w, http.StatusBadRequest, "og_image harus URL http(s) atau path /uploads/... — skema lain ditolak")
		return
	}
	p.OGImage = strings.TrimSpace(p.OGImage)
	s := &models.LandingSection{
		Slug:            p.Slug,
		Subdomain:       p.Subdomain,
		Judul:           p.Judul,
		KontenHTML:      p.KontenHTML,
		MetaTitle:       p.MetaTitle,
		MetaDescription: p.MetaDescription,
		OGImage:         p.OGImage,
		Urutan:          p.Urutan,
		TampilDiMenu:    p.TampilDiMenu,
		IsPublished:     p.IsPublished,
	}
	if err := models.CreateSection(s, currentUserID(r)); err != nil {
		if isUniqueViolation(err) {
			landingErr(w, http.StatusBadRequest, "slug atau subdomain sudah dipakai")
			return
		}
		landingErr(w, http.StatusInternalServerError, "gagal menyimpan section")
		return
	}
	models.RefreshLandingCache()
	writeJSON(w, s)
}

// AdminUpdateSection — PUT /api/landing/admin/sections/{id}
func AdminUpdateSection(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		landingErr(w, http.StatusBadRequest, "id tidak valid")
		return
	}
	var p sectionPayload
	if !decodeBodyLimited(w, r, &p) {
		return
	}
	if !slugRe.MatchString(p.Slug) {
		landingErr(w, http.StatusBadRequest, "slug tidak valid (huruf kecil, angka, tanda hubung)")
		return
	}
	if strings.TrimSpace(p.Judul) == "" {
		landingErr(w, http.StatusBadRequest, "judul wajib diisi")
		return
	}
	if p.Subdomain != nil && *p.Subdomain != "" {
		if !slugRe.MatchString(*p.Subdomain) {
			landingErr(w, http.StatusBadRequest, "subdomain tidak valid")
			return
		}
		if subdomainTerlarang[*p.Subdomain] {
			landingErr(w, http.StatusBadRequest, "subdomain \""+*p.Subdomain+"\" dipakai sistem, pilih label lain")
			return
		}
	}
	if !ogImageValid(p.OGImage) {
		landingErr(w, http.StatusBadRequest, "og_image harus URL http(s) atau path /uploads/... — skema lain ditolak")
		return
	}
	p.OGImage = strings.TrimSpace(p.OGImage)
	s := &models.LandingSection{
		ID:              id,
		Slug:            p.Slug,
		Subdomain:       p.Subdomain,
		Judul:           p.Judul,
		KontenHTML:      p.KontenHTML,
		MetaTitle:       p.MetaTitle,
		MetaDescription: p.MetaDescription,
		OGImage:         p.OGImage,
		Urutan:          p.Urutan,
		TampilDiMenu:    p.TampilDiMenu,
		IsPublished:     p.IsPublished,
	}
	if err := models.UpdateSection(s, currentUserID(r)); err != nil {
		if errors.Is(err, models.ErrLandingNotFound) {
			landingErr(w, http.StatusNotFound, "section tidak ditemukan")
			return
		}
		if isUniqueViolation(err) {
			landingErr(w, http.StatusBadRequest, "slug atau subdomain sudah dipakai")
			return
		}
		landingErr(w, http.StatusInternalServerError, "gagal menyimpan section")
		return
	}
	models.RefreshLandingCache()
	writeJSON(w, s)
}

// AdminDeleteSection — DELETE /api/landing/admin/sections/{id}
func AdminDeleteSection(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		landingErr(w, http.StatusBadRequest, "id tidak valid")
		return
	}
	if err := models.DeleteSection(id); err != nil {
		if errors.Is(err, models.ErrLandingNotFound) {
			landingErr(w, http.StatusNotFound, "section tidak ditemukan")
			return
		}
		landingErr(w, http.StatusInternalServerError, "gagal menghapus section")
		return
	}
	models.RefreshLandingCache()
	writeJSON(w, map[string]string{"status": "sukses"})
}

// AdminUpdateSettings — PUT /api/landing/admin/settings
func AdminUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var values map[string]string
	if !decodeBodyLimited(w, r, &values) {
		return
	}
	if len(values) == 0 {
		landingErr(w, http.StatusBadRequest, "tidak ada data")
		return
	}
	for k := range values {
		if !settingKeyRe.MatchString(k) {
			landingErr(w, http.StatusBadRequest, "key settings tidak valid: "+k)
			return
		}
	}
	if err := models.UpdateSettings(values, currentUserID(r)); err != nil {
		landingErr(w, http.StatusInternalServerError, "gagal menyimpan settings")
		return
	}
	models.RefreshLandingCache()
	writeJSON(w, map[string]string{"status": "sukses"})
}
