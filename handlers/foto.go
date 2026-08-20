package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mubtadiaat/app/models"
)

func UploadFotoSantri(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")

	// Parse form with max 2MB
	err := r.ParseMultipartForm(2 << 20)
	if err != nil {
		http.Error(w, "File terlalu besar. Max 2MB", http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("foto")
	if err != nil {
		http.Error(w, "Gagal membaca file upload", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate extension
	ext := strings.ToLower(filepath.Ext(handler.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		http.Error(w, "Format file harus jpg/png", http.StatusBadRequest)
		return
	}

	filename := uuid.New().String() + ext

	// Ensure dir exists
	workDir, _ := os.Getwd()
	uploadDir := filepath.Join(workDir, "public", "dist", "uploads", "foto-santri")
	os.MkdirAll(uploadDir, 0755)

	dstPath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		http.Error(w, "Gagal menyimpan file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Gagal menyimpan file", http.StatusInternalServerError)
		return
	}

	// Fetch old photo URL to delete it if exists (Fix 16 requirement)
	// Let's get the santri data to see old foto url
	// Assuming GetSantriByID requires context, role and userID, but we can do a direct query in models
	
	oldUrl, _ := models.GetSantriFotoURL(r.Context(), idStr)
	if oldUrl != "" {
		oldPath := filepath.Join(workDir, "public", "dist", filepath.FromSlash(oldUrl))
		os.Remove(oldPath) // Delete old photo
	}

	urlPath := "/uploads/foto-santri/" + filename
	err = models.UpdateFotoSantri(r.Context(), idStr, urlPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status":   "success",
		"foto_url": urlPath,
	})
}
