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

	"github.com/go-chi/chi/v5"
	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// Dua set terpisah: base.html diparse ulang per-page supaya
// {{define "content"}} di section.html dan home.html tidak saling
// menimpa (dalam satu set, definisi terakhir yang menang).
var landingTmplSection = template.Must(template.ParseFiles(
	"templates/landing/base.html",
	"templates/landing/section.html",
))

var landingTmplHome = template.Must(template.ParseFiles(
	"templates/landing/base.html",
	"templates/landing/home.html",
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
	KontenHTML      template.HTML
	Sections        []models.LandingSection
	Settings        map[string]string
	SiteName        string
	Apex            string
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
	}
}

func renderLanding(w http.ResponseWriter, name string, data LandingPageData) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	tmpl := landingTmplSection
	if name == "home.html" {
		tmpl = landingTmplHome
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

// AdminCreateSection — POST /api/landing/admin/sections
func AdminCreateSection(w http.ResponseWriter, r *http.Request) {
	var p sectionPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		landingErr(w, http.StatusBadRequest, "payload tidak valid")
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
	if p.Subdomain != nil && *p.Subdomain != "" && !slugRe.MatchString(*p.Subdomain) {
		landingErr(w, http.StatusBadRequest, "subdomain tidak valid")
		return
	}
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
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		landingErr(w, http.StatusBadRequest, "payload tidak valid")
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
	if p.Subdomain != nil && *p.Subdomain != "" && !slugRe.MatchString(*p.Subdomain) {
		landingErr(w, http.StatusBadRequest, "subdomain tidak valid")
		return
	}
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
	if err := json.NewDecoder(r.Body).Decode(&values); err != nil {
		landingErr(w, http.StatusBadRequest, "payload tidak valid")
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
