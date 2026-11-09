package models

import (
	"context"
	"errors"
	"log"
	"strings"
	"sync/atomic"
	"time"

	"github.com/microcosm-cc/bluemonday"
	"github.com/mubtadiaat/app/config"
)

// LandingSection — satu halaman CMS (section) pada landing page.
type LandingSection struct {
	ID              int       `json:"id"`
	Slug            string    `json:"slug"`
	Subdomain       *string   `json:"subdomain"`
	Judul           string    `json:"judul"`
	KontenHTML      string    `json:"konten_html"`
	MetaTitle       string    `json:"meta_title"`
	MetaDescription string    `json:"meta_description"`
	OGImage         string    `json:"og_image"`
	Urutan          int       `json:"urutan"`
	TampilDiMenu    bool      `json:"tampil_di_menu"`
	IsPublished     bool      `json:"is_published"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// LandingSetting — baris key/value konfigurasi situs (footer, SEO, sosmed).
type LandingSetting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	Label string `json:"label"`
	Grup  string `json:"grup"`
}

// ErrLandingNotFound — section tidak ada (update/delete 0 baris).
var ErrLandingNotFound = errors.New("section tidak ditemukan")

type landingCacheData struct {
	Subdomains map[string]string // label subdomain -> slug (published only)
	Settings   map[string]string // key -> value
}

var landingCache atomic.Pointer[landingCacheData]

// LookupSubdomain — AMAN-NIL: kalau cache belum terisi (mis. DB gagal
// query saat boot), balikin ("", false), tidak panic.
func LookupSubdomain(label string) (string, bool) {
	ptr := landingCache.Load()
	if ptr == nil {
		return "", false
	}
	slug, ok := ptr.Subdomains[strings.ToLower(label)]
	return slug, ok
}

// LandingSettings — snapshot settings dari cache; map kosong (bukan nil)
// kalau cache belum terisi.
func LandingSettings() map[string]string {
	if ptr := landingCache.Load(); ptr != nil {
		return ptr.Settings
	}
	return map[string]string{}
}

// RefreshLandingCache — muat ulang subdomain + settings ke memory.
// Dipanggil saat boot, tiap 5 menit, dan setelah admin menyimpan.
func RefreshLandingCache() {
	data := &landingCacheData{
		Subdomains: map[string]string{},
		Settings:   map[string]string{},
	}

	rows, err := config.DB.Query(context.Background(),
		`SELECT subdomain, slug FROM landing_sections
		 WHERE subdomain IS NOT NULL AND is_published`)
	if err != nil {
		log.Printf("[LANDING-CACHE] gagal muat subdomain: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var sub, slug string
			if rows.Scan(&sub, &slug) == nil {
				data.Subdomains[strings.ToLower(sub)] = slug
			}
		}
	}

	srows, err := config.DB.Query(context.Background(),
		`SELECT key, value FROM landing_settings`)
	if err != nil {
		log.Printf("[LANDING-CACHE] gagal muat settings: %v", err)
	} else {
		defer srows.Close()
		for srows.Next() {
			var k, v string
			if srows.Scan(&k, &v) == nil {
				data.Settings[k] = v
			}
		}
	}

	landingCache.Store(data)
}

// ---- Sanitasi HTML (anti stored-XSS dari editor rich-text) ----

var htmlSanitizer *bluemonday.Policy

func init() {
	p := bluemonday.UGCPolicy()
	// Quill menyimpan alignment/size pada atribut class (ql-align-center),
	// bukan style — class di-allow, style tidak.
	p.AllowAttrs("class").Globally()
	// Elemen & atribut yang dibutuhkan editor + konten pesantren.
	p.AllowElements("h1", "h2", "h3", "h4", "h5", "h6",
		"table", "thead", "tbody", "tfoot", "tr", "th", "td",
		"blockquote", "hr", "span", "figure", "figcaption", "pre", "code")
	p.AllowAttrs("src", "alt", "width", "height").OnElements("img")
	p.AllowAttrs("colspan", "rowspan").OnElements("td", "th")
	htmlSanitizer = p
}

// SanitizeLandingHTML — bersihkan HTML dari editor (bluemonday UGCPolicy +
// allowlist di atas). Dipanggil saat simpan DAN saat render (defense in
// depth: konten yang ditulis lewat jalur lain tetap aman saat tampil).
func SanitizeLandingHTML(html string) string {
	return htmlSanitizer.Sanitize(html)
}

// ---- Query ----

const landingSectionCols = `id, slug, subdomain, judul, konten_html,
	meta_title, meta_description, og_image, urutan, tampil_di_menu,
	is_published, created_at, updated_at`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanLandingSection(row rowScanner) (*LandingSection, error) {
	s := &LandingSection{}
	err := row.Scan(&s.ID, &s.Slug, &s.Subdomain, &s.Judul, &s.KontenHTML,
		&s.MetaTitle, &s.MetaDescription, &s.OGImage, &s.Urutan,
		&s.TampilDiMenu, &s.IsPublished, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// GetSectionBySlug — publishedOnly=true untuk halaman publik.
func GetSectionBySlug(slug string, publishedOnly bool) (*LandingSection, error) {
	q := `SELECT ` + landingSectionCols + ` FROM landing_sections WHERE slug = $1`
	if publishedOnly {
		q += ` AND is_published = true`
	}
	return scanLandingSection(config.DB.QueryRow(context.Background(), q, slug))
}

// ListSections — publishedOnly=true untuk menu/nav publik.
func ListSections(publishedOnly bool) ([]LandingSection, error) {
	q := `SELECT ` + landingSectionCols + ` FROM landing_sections`
	if publishedOnly {
		q += ` WHERE is_published = true`
	}
	q += ` ORDER BY urutan, id`
	rows, err := config.DB.Query(context.Background(), q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []LandingSection
	for rows.Next() {
		s, err := scanLandingSection(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

// ListSettings — semua baris settings (form admin).
func ListSettings() ([]LandingSetting, error) {
	rows, err := config.DB.Query(context.Background(),
		`SELECT key, value, label, grup FROM landing_settings ORDER BY grup, key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []LandingSetting
	for rows.Next() {
		var s LandingSetting
		if err := rows.Scan(&s.Key, &s.Value, &s.Label, &s.Grup); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ---- Mutasi (admin) ----

func normSubdomain(s *string) *string {
	if s == nil {
		return nil
	}
	v := strings.ToLower(strings.TrimSpace(*s))
	if v == "" {
		return nil
	}
	return &v
}

// CreateSection — konten_html disanitasi sebelum disimpan.
func CreateSection(s *LandingSection, userID int) error {
	s.KontenHTML = SanitizeLandingHTML(s.KontenHTML)
	return config.DB.QueryRow(context.Background(),
		`INSERT INTO landing_sections
		 (slug, subdomain, judul, konten_html, meta_title, meta_description,
		  og_image, urutan, tampil_di_menu, is_published, created_by, updated_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
		 RETURNING id, created_at, updated_at`,
		s.Slug, normSubdomain(s.Subdomain), s.Judul, s.KontenHTML,
		s.MetaTitle, s.MetaDescription, s.OGImage, s.Urutan,
		s.TampilDiMenu, s.IsPublished, userID,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

// UpdateSection — konten_html disanitasi sebelum disimpan.
func UpdateSection(s *LandingSection, userID int) error {
	s.KontenHTML = SanitizeLandingHTML(s.KontenHTML)
	tag, err := config.DB.Exec(context.Background(),
		`UPDATE landing_sections SET
			slug = $1, subdomain = $2, judul = $3, konten_html = $4,
			meta_title = $5, meta_description = $6, og_image = $7,
			urutan = $8, tampil_di_menu = $9, is_published = $10,
			updated_at = NOW(), updated_by = $11
		 WHERE id = $12`,
		s.Slug, normSubdomain(s.Subdomain), s.Judul, s.KontenHTML,
		s.MetaTitle, s.MetaDescription, s.OGImage, s.Urutan,
		s.TampilDiMenu, s.IsPublished, userID, s.ID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrLandingNotFound
	}
	return nil
}

// DeleteSection
func DeleteSection(id int) error {
	tag, err := config.DB.Exec(context.Background(),
		`DELETE FROM landing_sections WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrLandingNotFound
	}
	return nil
}

// UpdateSettings — upsert key/value; key baru akan dibuat.
func UpdateSettings(values map[string]string, userID int) error {
	for k, v := range values {
		_, err := config.DB.Exec(context.Background(),
			`INSERT INTO landing_settings (key, value, updated_by, updated_at)
			 VALUES ($1, $2, $3, NOW())
			 ON CONFLICT (key) DO UPDATE SET
				value = EXCLUDED.value,
				updated_by = EXCLUDED.updated_by,
				updated_at = NOW()`,
			k, v, userID)
		if err != nil {
			return err
		}
	}
	return nil
}
