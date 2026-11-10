package models

// Berita pesantren untuk portal landing (beranda, /berita, /berita/{slug}).
// Ditulis pimpinan dari panel; konten disanitasi dengan kebijakan yang sama
// seperti section (SanitizeLandingHTML), cover wajib path lokal atau http(s).

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/mubtadiaat/app/config"
)

// LandingNews — satu berita.
type LandingNews struct {
	ID          int       `json:"id"`
	Slug        string    `json:"slug"`
	Judul       string    `json:"judul"`
	Kategori    string    `json:"kategori"`
	Ringkasan   string    `json:"ringkasan"`
	KontenHTML  string    `json:"konten_html"`
	CoverURL    string    `json:"cover_url"`
	IsPublished bool      `json:"is_published"`
	IsHeadline  bool      `json:"is_headline"`
	PublishedAt time.Time `json:"published_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ErrNewsNotFound — berita tidak ada (update/delete 0 baris).
var ErrNewsNotFound = errors.New("berita tidak ditemukan")

// NewsKategori — kategori tetap (dipakai validasi + label UI).
var NewsKategori = []string{"pengumuman", "kegiatan", "prestasi", "artikel"}

// NewsKategoriLabel — label tampilan untuk template.
var NewsKategoriLabel = map[string]string{
	"pengumuman": "Pengumuman",
	"kegiatan":   "Kegiatan",
	"prestasi":   "Prestasi",
	"artikel":    "Artikel",
}

// ValidNewsKategori — true kalau kategori termasuk daftar tetap.
func ValidNewsKategori(k string) bool {
	for _, v := range NewsKategori {
		if v == k {
			return true
		}
	}
	return false
}

const newsCols = `id, slug, judul, kategori, ringkasan, konten_html, cover_url,
	is_published, is_headline, published_at, created_at, updated_at`

func scanNews(row rowScanner) (*LandingNews, error) {
	n := &LandingNews{}
	err := row.Scan(&n.ID, &n.Slug, &n.Judul, &n.Kategori, &n.Ringkasan,
		&n.KontenHTML, &n.CoverURL, &n.IsPublished, &n.IsHeadline,
		&n.PublishedAt, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return n, nil
}

// ListNews — daftar berita. publishedOnly=true untuk halaman publik.
// kategori kosong = semua kategori. limit<=0 = 50.
func ListNews(publishedOnly bool, kategori string, limit, offset int) ([]LandingNews, error) {
	if limit <= 0 {
		limit = 50
	}
	q := `SELECT ` + newsCols + ` FROM landing_news WHERE 1=1`
	args := []any{}
	if publishedOnly {
		q += ` AND is_published AND published_at <= now()`
	}
	if kategori != "" {
		args = append(args, kategori)
		q += ` AND kategori = $` + newsItoa(len(args))
	}
	args = append(args, limit, offset)
	q += ` ORDER BY published_at DESC, id DESC LIMIT $` + newsItoa(len(args)-1) +
		` OFFSET $` + newsItoa(len(args))

	rows, err := config.DB.Query(context.Background(), q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]LandingNews, 0, limit)
	for rows.Next() {
		n, err := scanNews(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *n)
	}
	return out, rows.Err()
}

// CountNews — jumlah baris (untuk paginasi).
func CountNews(publishedOnly bool, kategori string) (int, error) {
	q := `SELECT count(*) FROM landing_news WHERE 1=1`
	args := []any{}
	if publishedOnly {
		q += ` AND is_published AND published_at <= now()`
	}
	if kategori != "" {
		args = append(args, kategori)
		q += ` AND kategori = $1`
	}
	var n int
	err := config.DB.QueryRow(context.Background(), q, args...).Scan(&n)
	return n, err
}

// HomeNews — satu berita utama + sisanya untuk blok beranda.
// Utama = is_headline terbaru; kalau tidak ada yang di-pin, ambil terbaru.
func HomeNews(limit int) (*LandingNews, []LandingNews) {
	if limit < 2 {
		limit = 4
	}
	all, err := ListNews(true, "", limit, 0)
	if err != nil || len(all) == 0 {
		return nil, nil
	}
	pinned, err := GetNewsHeadline()
	if err != nil || pinned == nil {
		return &all[0], all[1:]
	}
	rest := make([]LandingNews, 0, len(all))
	for _, n := range all {
		if n.ID != pinned.ID {
			rest = append(rest, n)
		}
	}
	if len(rest) > limit-1 {
		rest = rest[:limit-1]
	}
	return pinned, rest
}

// GetNewsHeadline — berita yang di-pin sebagai utama (published saja).
func GetNewsHeadline() (*LandingNews, error) {
	q := `SELECT ` + newsCols + ` FROM landing_news
	       WHERE is_published AND is_headline AND published_at <= now()
	       ORDER BY published_at DESC, id DESC LIMIT 1`
	n, err := scanNews(config.DB.QueryRow(context.Background(), q))
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return nil, nil
		}
		return nil, err
	}
	return n, nil
}

// GetNewsBySlug — detail publik (publishedOnly=true untuk pengunjung).
func GetNewsBySlug(slug string, publishedOnly bool) (*LandingNews, error) {
	q := `SELECT ` + newsCols + ` FROM landing_news WHERE slug = $1`
	if publishedOnly {
		q += ` AND is_published AND published_at <= now()`
	}
	n, err := scanNews(config.DB.QueryRow(context.Background(), q, slug))
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return nil, ErrNewsNotFound
		}
		return nil, err
	}
	return n, nil
}

// GetNewsByID — dipakai panel (termasuk draft).
func GetNewsByID(id int) (*LandingNews, error) {
	n, err := scanNews(config.DB.QueryRow(context.Background(),
		`SELECT `+newsCols+` FROM landing_news WHERE id = $1`, id))
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return nil, ErrNewsNotFound
		}
		return nil, err
	}
	return n, nil
}

// CreateNews — slug unik; konten disanitasi sebelum simpan.
func CreateNews(n *LandingNews, userID int) error {
	n.KontenHTML = SanitizeLandingHTML(n.KontenHTML)
	if n.PublishedAt.IsZero() {
		n.PublishedAt = time.Now()
	}
	err := config.DB.QueryRow(context.Background(), `
		INSERT INTO landing_news
		  (slug, judul, kategori, ringkasan, konten_html, cover_url,
		   is_published, is_headline, published_at, created_by, updated_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
		RETURNING id, created_at, updated_at`,
		n.Slug, n.Judul, n.Kategori, n.Ringkasan, n.KontenHTML, n.CoverURL,
		n.IsPublished, n.IsHeadline, n.PublishedAt, userID,
	).Scan(&n.ID, &n.CreatedAt, &n.UpdatedAt)
	return err
}

// UpdateNews — full replace (semua field dikirim panel).
func UpdateNews(n *LandingNews, userID int) error {
	n.KontenHTML = SanitizeLandingHTML(n.KontenHTML)
	if n.PublishedAt.IsZero() {
		n.PublishedAt = time.Now()
	}
	tag, err := config.DB.Exec(context.Background(), `
		UPDATE landing_news SET
		  slug=$1, judul=$2, kategori=$3, ringkasan=$4, konten_html=$5,
		  cover_url=$6, is_published=$7, is_headline=$8, published_at=$9,
		  updated_by=$10, updated_at=now()
		WHERE id=$11`,
		n.Slug, n.Judul, n.Kategori, n.Ringkasan, n.KontenHTML, n.CoverURL,
		n.IsPublished, n.IsHeadline, n.PublishedAt, userID, n.ID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNewsNotFound
	}
	return nil
}

// DeleteNews — hapus permanen.
func DeleteNews(id int) error {
	tag, err := config.DB.Exec(context.Background(),
		`DELETE FROM landing_news WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNewsNotFound
	}
	return nil
}

// newsItoa — kecil, tanpa import strconv di file ini (placeholder $n).
func newsItoa(i int) string {
	if i == 0 {
		return "0"
	}
	var b [4]byte
	p := len(b)
	for i > 0 {
		p--
		b[p] = byte('0' + i%10)
		i /= 10
	}
	return string(b[p:])
}
