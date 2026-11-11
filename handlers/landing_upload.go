package handlers

// Upload gambar untuk CMS landing (khusus pimpinan).
// File disimpan di public/dist/uploads/landing (volume `uploads`, awet saat rebuild).
// Dipakai panel: tombol "Upload Foto" dan galeri di editor section.

import (
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const landingUploadMax = 4 << 20 // 4 MB

// uploadLimitPerJam — batas upload per user per jam. Login sudah dibatasi,
// upload belum: akun pimpinan yang bocor bisa dipakai membanjiri disk.
// Counter in-memory (reset saat restart) — cukup untuk meredam banjir,
// tidak perlu tabel baru.
const uploadLimitPerJam = 200

var uploadCounter = struct {
	sync.Mutex
	m map[int][]time.Time
}{m: make(map[int][]time.Time)}

// allowUpload — true kalau user masih di bawah kuota 1 jam terakhir.
func allowUpload(userID int) bool {
	now := time.Now()
	batas := now.Add(-time.Hour)
	uploadCounter.Lock()
	defer uploadCounter.Unlock()
	ts := uploadCounter.m[userID]
	keep := make([]time.Time, 0, len(ts))
	for _, t := range ts {
		if t.After(batas) {
			keep = append(keep, t)
		}
	}
	if len(keep) >= uploadLimitPerJam {
		uploadCounter.m[userID] = keep
		return false
	}
	uploadCounter.m[userID] = append(keep, now)
	return true
}

type landingImage struct {
	Name   string `json:"name"`
	URL    string `json:"url"`
	Size   int64  `json:"size"`
	Width  int    `json:"width,omitempty"`
	Height int    `json:"height,omitempty"`
	MTime  int64  `json:"mtime"`
}

func landingUploadDir() string {
	workDir, _ := os.Getwd()
	return filepath.Join(workDir, "public", "dist", "uploads", "landing")
}

// AdminUploadLandingImage — POST /api/landing/admin/upload (multipart, field "foto").
func AdminUploadLandingImage(w http.ResponseWriter, r *http.Request) {
	if !allowUpload(currentUserID(r)) {
		writeJSONError(w, "Terlalu banyak upload dalam 1 jam (maksimal 200). Coba lagi nanti.", http.StatusTooManyRequests)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, landingUploadMax+1<<20)
	if err := r.ParseMultipartForm(landingUploadMax); err != nil {
		writeJSONError(w, "File terlalu besar. Maksimal 4 MB.", http.StatusBadRequest)
		return
	}
	file, fh, err := r.FormFile("foto")
	if err != nil {
		writeJSONError(w, "Gagal membaca file upload.", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if fh.Size > landingUploadMax {
		writeJSONError(w, "File terlalu besar. Maksimal 4 MB.", http.StatusBadRequest)
		return
	}

	// Deteksi tipe dari isi file, jangan percaya ekstensi saja.
	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	head = head[:n]
	ct := http.DetectContentType(head)
	var ext string
	switch ct {
	case "image/jpeg":
		ext = ".jpg"
	case "image/png":
		ext = ".png"
	case "image/webp":
		ext = ".webp"
	default:
		writeJSONError(w, "Format harus JPG, PNG, atau WEBP.", http.StatusBadRequest)
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		writeJSONError(w, "Gagal membaca file upload.", http.StatusBadRequest)
		return
	}

	dir := landingUploadDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		writeJSONError(w, "Gagal menyiapkan folder upload.", http.StatusInternalServerError)
		return
	}

	base := slugifyFilename(strings.TrimSuffix(fh.Filename, filepath.Ext(fh.Filename)))
	if base == "" {
		base = "foto"
	}
	if len(base) > 40 {
		base = base[:40]
	}
	filename := base + "-" + uuid.New().String()[:8] + ext
	dstPath := filepath.Join(dir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		writeJSONError(w, "Gagal menyimpan file.", http.StatusInternalServerError)
		return
	}
	size, copyErr := io.Copy(dst, file)
	dst.Close()
	if copyErr != nil {
		os.Remove(dstPath)
		writeJSONError(w, "Gagal menyimpan file.", http.StatusInternalServerError)
		return
	}

	out := landingImage{
		Name: filename,
		URL:  "/uploads/landing/" + filename,
		Size: size,
	}
	if f, err := os.Open(dstPath); err == nil {
		if cfg, _, err := image.DecodeConfig(f); err == nil {
			out.Width, out.Height = cfg.Width, cfg.Height
		}
		f.Close()
	}
	if st, err := os.Stat(dstPath); err == nil {
		out.MTime = st.ModTime().Unix()
	}

	writeJSON(w, out)
}

// AdminListLandingImages — GET /api/landing/admin/images.
func AdminListLandingImages(w http.ResponseWriter, r *http.Request) {
	dir := landingUploadDir()
	entries, err := os.ReadDir(dir)
	if err != nil && !os.IsNotExist(err) {
		writeJSONError(w, "Gagal membaca folder upload.", http.StatusInternalServerError)
		return
	}
	out := make([]landingImage, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, landingImage{
			Name:  e.Name(),
			URL:   "/uploads/landing/" + e.Name(),
			Size:  info.Size(),
			MTime: info.ModTime().Unix(),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].MTime > out[j].MTime })

	writeJSON(w, out)
}

// AdminDeleteLandingImage — DELETE /api/landing/admin/images/{name}.
func AdminDeleteLandingImage(w http.ResponseWriter, r *http.Request) {
	name := filepath.Base(chi.URLParam(r, "name"))
	if name == "." || name == ".." || name == "" {
		writeJSONError(w, "Nama file tidak valid.", http.StatusBadRequest)
		return
	}
	path := filepath.Join(landingUploadDir(), name)
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			writeJSONError(w, "File tidak ditemukan.", http.StatusNotFound)
			return
		}
		writeJSONError(w, "Gagal menghapus file.", http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "ok", "name": name})
}

// slugifyFilename — nama file aman: huruf kecil, angka, tanda hubung.
func slugifyFilename(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		case r == '-' || r == '_' || r == ' ':
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}
