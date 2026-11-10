package handlers

// Berita pesantren: halaman publik (/berita, /berita/{slug}), API publik,
// dan CRUD panel pimpinan. Pola mengikuti section landing (lihat landing.go).

import (
	"errors"
	"html/template"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/models"
)

// NewsView — bentuk siap-tampil (tanggal & label sudah diformat).
type NewsView struct {
	ID            int
	Slug          string
	Judul         string
	Kategori      string
	KategoriLabel string
	Ringkasan     string
	KontenHTML    template.HTML
	CoverURL      string
	Tanggal       string
	TanggalISO    string
	IsHeadline    bool
}

// KategoriView — chip filter kategori di /berita.
type KategoriView struct {
	Key    string
	Label  string
	Active bool
}

var bulanID = [...]string{"", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
	"Juli", "Agustus", "September", "Oktober", "November", "Desember"}

// tanggalID — "3 November 2026" (zona waktu lokal server; konten pesantren
// tidak perlu presisi jam, tanggal cukup).
func tanggalID(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return strconv.Itoa(t.Day()) + " " + bulanID[int(t.Month())] + " " + strconv.Itoa(t.Year())
}

// absolutkan — path lokal ("/media/...") jadi absolut di apex supaya og:image
// valid saat dibagikan ke WhatsApp/Facebook.
func absolutkan(u string) string {
	u = strings.TrimSpace(u)
	if u == "" {
		return ""
	}
	if strings.HasPrefix(u, "/") && !strings.HasPrefix(u, "//") {
		return "https://" + landingApex + u
	}
	return u
}

func newsView(n *models.LandingNews) NewsView {
	label := models.NewsKategoriLabel[n.Kategori]
	if label == "" {
		label = n.Kategori
	}
	return NewsView{
		ID:            n.ID,
		Slug:          n.Slug,
		Judul:         n.Judul,
		Kategori:      n.Kategori,
		KategoriLabel: label,
		Ringkasan:     n.Ringkasan,
		KontenHTML:    template.HTML(models.SanitizeLandingHTML(n.KontenHTML)),
		CoverURL:      absolutkan(n.CoverURL),
		Tanggal:       tanggalID(n.PublishedAt),
		TanggalISO:    n.PublishedAt.Format("2006-01-02"),
		IsHeadline:    n.IsHeadline,
	}
}

func newsViews(list []models.LandingNews) []NewsView {
	out := make([]NewsView, 0, len(list))
	for i := range list {
		out = append(out, newsView(&list[i]))
	}
	return out
}

// ---------- halaman publik ----------

// NewsIndex — GET /berita?kategori=&page=
func NewsIndex(w http.ResponseWriter, r *http.Request) {
	const perPage = 9
	kat := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("kategori")))
	if kat != "" && !models.ValidNewsKategori(kat) {
		kat = ""
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	total, err := models.CountNews(true, kat)
	if err != nil {
		log.Printf("[NEWS] count gagal: %v", err)
		http.Error(w, "gagal memuat berita", http.StatusInternalServerError)
		return
	}
	pages := (total + perPage - 1) / perPage
	if pages < 1 {
		pages = 1
	}
	if page > pages {
		page = pages
	}
	list, err := models.ListNews(true, kat, perPage, (page-1)*perPage)
	if err != nil {
		log.Printf("[NEWS] list gagal: %v", err)
		http.Error(w, "gagal memuat berita", http.StatusInternalServerError)
		return
	}

	data := landingBaseData()
	data.Judul = "Berita"
	data.MetaTitle = "Berita — " + data.SiteName
	if kat != "" {
		data.MetaTitle = models.NewsKategoriLabel[kat] + " — " + data.SiteName
	}
	data.MetaDescription = data.Settings["seo_description"]
	data.Canonical = "https://" + landingApex + "/berita"
	if page > 1 {
		data.Canonical += "?page=" + strconv.Itoa(page)
	}
	data.NewsList = newsViews(list)
	data.NewsPage = page
	data.NewsPages = pages
	data.NewsTotal = total
	data.NewsKategori = kat
	data.NewsKategoriList = kategoriViews(kat)
	renderLanding(w, "news_index.html", data)
}

func kategoriViews(active string) []KategoriView {
	out := make([]KategoriView, 0, len(models.NewsKategori))
	for _, k := range models.NewsKategori {
		out = append(out, KategoriView{Key: k, Label: models.NewsKategoriLabel[k], Active: k == active})
	}
	return out
}

// NewsDetail — GET /berita/{slug}
func NewsDetail(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	n, err := models.GetNewsBySlug(slug, true)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	v := newsView(n)
	data := landingBaseData()
	data.Judul = n.Judul
	data.MetaTitle = n.Judul
	data.MetaDescription = n.Ringkasan
	data.Canonical = "https://" + landingApex + "/berita/" + n.Slug
	data.OgImage = v.CoverURL
	data.NewsDetail = &v
	// Berita lain untuk blok "Berita lainnya" (3 terbaru, selain yang dibuka).
	others, _ := models.ListNews(true, "", 4, 0)
	filtered := make([]models.LandingNews, 0, 3)
	for _, o := range others {
		if o.ID != n.ID && len(filtered) < 3 {
			filtered = append(filtered, o)
		}
	}
	data.NewsList = newsViews(filtered)
	renderLanding(w, "news_detail.html", data)
}

// ---------- API publik ----------

// APILandingNews — GET /api/landing/news?kategori=&limit=
func APILandingNews(w http.ResponseWriter, r *http.Request) {
	kat := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("kategori")))
	if kat != "" && !models.ValidNewsKategori(kat) {
		kat = ""
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	list, err := models.ListNews(true, kat, limit, 0)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		writeJSON(w, map[string]string{"error": "gagal memuat berita"})
		return
	}
	writeJSON(w, list)
}

// APILandingNewsDetail — GET /api/landing/news/{slug}
func APILandingNewsDetail(w http.ResponseWriter, r *http.Request) {
	n, err := models.GetNewsBySlug(chi.URLParam(r, "slug"), true)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		writeJSON(w, map[string]string{"error": "berita tidak ditemukan"})
		return
	}
	writeJSON(w, n)
}

// ---------- admin (panel pimpinan) ----------

type newsPayload struct {
	Slug        string `json:"slug"`
	Judul       string `json:"judul"`
	Kategori    string `json:"kategori"`
	Ringkasan   string `json:"ringkasan"`
	KontenHTML  string `json:"konten_html"`
	CoverURL    string `json:"cover_url"`
	IsPublished bool   `json:"is_published"`
	IsHeadline  bool   `json:"is_headline"`
	Tanggal     string `json:"tanggal"` // YYYY-MM-DD (opsional)
}

// newsFromPayload — validasi bersama create/update. Balas pesan error kalau
// ada yang tidak lolos (string kosong = lolos).
func newsFromPayload(p newsPayload) (*models.LandingNews, string) {
	slug := strings.TrimSpace(p.Slug)
	if !slugRe.MatchString(slug) {
		return nil, "slug tidak valid (huruf kecil, angka, tanda hubung)"
	}
	judul := strings.TrimSpace(p.Judul)
	if judul == "" {
		return nil, "judul wajib diisi"
	}
	kat := strings.TrimSpace(p.Kategori)
	if kat == "" {
		kat = "kegiatan"
	}
	if !models.ValidNewsKategori(kat) {
		return nil, "kategori tidak valid (pengumuman/kegiatan/prestasi/artikel)"
	}
	// Cover WAJIB path lokal: CSP landing hanya mengizinkan img-src 'self',
	// jadi URL host lain akan jadi gambar rusak. Foto masuk lewat tombol
	// Upload / Galeri di panel yang menyimpan ke /uploads/landing/.
	cover := strings.TrimSpace(p.CoverURL)
	if cover != "" && !(strings.HasPrefix(cover, "/") && !strings.HasPrefix(cover, "//")) {
		return nil, "cover harus path lokal dari Upload/Galeri (mis. /uploads/landing/foto.jpg)"
	}
	ringkasan := strings.TrimSpace(p.Ringkasan)
	if len([]rune(ringkasan)) > 400 {
		return nil, "ringkasan maksimal 400 karakter"
	}
	publishedAt := time.Now()
	if t := strings.TrimSpace(p.Tanggal); t != "" {
		if parsed, err := time.Parse("2006-01-02", t); err == nil {
			publishedAt = parsed.Add(12 * time.Hour)
		}
	}
	return &models.LandingNews{
		Slug:        slug,
		Judul:       judul,
		Kategori:    kat,
		Ringkasan:   ringkasan,
		KontenHTML:  p.KontenHTML,
		CoverURL:    cover,
		IsPublished: p.IsPublished,
		IsHeadline:  p.IsHeadline,
		PublishedAt: publishedAt,
	}, ""
}

// AdminListNews — GET /api/landing/admin/news (termasuk draft).
func AdminListNews(w http.ResponseWriter, r *http.Request) {
	list, err := models.ListNews(false, "", 200, 0)
	if err != nil {
		landingErr(w, http.StatusInternalServerError, "gagal memuat berita")
		return
	}
	writeJSON(w, list)
}

// AdminCreateNews — POST /api/landing/admin/news
func AdminCreateNews(w http.ResponseWriter, r *http.Request) {
	var p newsPayload
	if !decodeBodyLimited(w, r, &p) {
		return
	}
	n, msg := newsFromPayload(p)
	if msg != "" {
		landingErr(w, http.StatusBadRequest, msg)
		return
	}
	if err := models.CreateNews(n, currentUserID(r)); err != nil {
		if isUniqueViolation(err) {
			landingErr(w, http.StatusBadRequest, "slug berita sudah dipakai")
			return
		}
		landingErr(w, http.StatusInternalServerError, "gagal menyimpan berita")
		return
	}
	writeJSON(w, n)
}

// AdminUpdateNews — PUT /api/landing/admin/news/{id}
func AdminUpdateNews(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		landingErr(w, http.StatusBadRequest, "id tidak valid")
		return
	}
	var p newsPayload
	if !decodeBodyLimited(w, r, &p) {
		return
	}
	n, msg := newsFromPayload(p)
	if msg != "" {
		landingErr(w, http.StatusBadRequest, msg)
		return
	}
	n.ID = id
	if err := models.UpdateNews(n, currentUserID(r)); err != nil {
		if errors.Is(err, models.ErrNewsNotFound) {
			landingErr(w, http.StatusNotFound, "berita tidak ditemukan")
			return
		}
		if isUniqueViolation(err) {
			landingErr(w, http.StatusBadRequest, "slug berita sudah dipakai")
			return
		}
		landingErr(w, http.StatusInternalServerError, "gagal menyimpan berita")
		return
	}
	writeJSON(w, n)
}

// AdminDeleteNews — DELETE /api/landing/admin/news/{id}
func AdminDeleteNews(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		landingErr(w, http.StatusBadRequest, "id tidak valid")
		return
	}
	if err := models.DeleteNews(id); err != nil {
		if errors.Is(err, models.ErrNewsNotFound) {
			landingErr(w, http.StatusNotFound, "berita tidak ditemukan")
			return
		}
		landingErr(w, http.StatusInternalServerError, "gagal menghapus berita")
		return
	}
	writeJSON(w, map[string]string{"status": "sukses"})
}
