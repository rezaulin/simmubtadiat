package handlers

// Handler untuk API Penilaian Tambahan (tab-tab baru di halaman Penilaian).
// Baca: pimpinan + mufatish + mustahiq (dibatasi cakupan bagian) [+ wali, fase 5]
// Tulis: pimpinan saja (keputusan owner).

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// tambahanBagianIDs mengembalikan ID bagian yang boleh dilihat user sesuai
// cakupan (pimpinan: semua; mustahiq/mufatish: kelas+tingkatan tugasannya).
func tambahanBagianIDs(w http.ResponseWriter, r *http.Request) ([]int, bool) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return nil, false
	}
	bagians, err := models.GetBagianForPenilaian(r.Context(), user.Roles, user.PengajarID)
	if err != nil {
		writeJSONError(w, internalError("", err), http.StatusInternalServerError)
		return nil, false
	}
	ids := make([]int, 0, len(bagians))
	for _, b := range bagians {
		ids = append(ids, b.ID)
	}
	return ids, true
}

func queryTA(r *http.Request) string {
	ta := r.URL.Query().Get("tahun_ajaran")
	if ta == "" {
		ta = models.GetTahunAjaranAktif(r.Context())
	}
	return ta
}

// parseBoolFilter: "" → nil (tanpa filter), "true"/"1" → true, "false"/"0" → false.
func parseBoolFilter(v string) (*bool, bool) {
	switch v {
	case "":
		return nil, true
	case "true", "1":
		b := true
		return &b, true
	case "false", "0":
		b := false
		return &b, true
	}
	return nil, false
}

// GetBawahRata — GET /api/penilaian-tambahan/bawah-rata
// Query: tahun_ajaran, kuartal (default 1), dalam_masa, selesai
func GetBawahRata(w http.ResponseWriter, r *http.Request) {
	ta := queryTA(r)
	kuartal := 1
	if v := r.URL.Query().Get("kuartal"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 4 {
			writeJSONError(w, "kuartal harus 1–4", http.StatusBadRequest)
			return
		}
		kuartal = n
	}
	dalamMasa, ok := parseBoolFilter(r.URL.Query().Get("dalam_masa"))
	if !ok {
		writeJSONError(w, "filter dalam_masa tidak valid", http.StatusBadRequest)
		return
	}
	selesai, ok := parseBoolFilter(r.URL.Query().Get("selesai"))
	if !ok {
		writeJSONError(w, "filter selesai tidak valid", http.StatusBadRequest)
		return
	}
	bagianIDs, ok := tambahanBagianIDs(w, r)
	if !ok {
		return
	}
	rows, err := models.GetBawahRata(r.Context(), ta, kuartal, dalamMasa, selesai, bagianIDs)
	if err != nil {
		writeJSONError(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	writeJSON(w, rows)
}

// SaveTakziran — POST /api/penilaian-tambahan/bawah-rata/takziran (pimpinan)
func SaveTakziran(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TahunAjaran string                 `json:"tahun_ajaran"`
		Items       []models.TakziranInput `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "format data tidak valid", http.StatusBadRequest)
		return
	}
	if len(req.Items) == 0 {
		writeJSONError(w, "tidak ada data yang disimpan", http.StatusBadRequest)
		return
	}
	if req.TahunAjaran == "" {
		req.TahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}
	if err := models.UpsertTakziran(r.Context(), req.TahunAjaran, req.Items); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "success", "message": "Takziran tersimpan"})
}

// GetJuzAmma — GET /api/penilaian-tambahan/juz-amma
// Query: tahun_ajaran, bagian_id, status (selesai|belum), evaluasi (lulus|her|tidak_lulus)
func GetJuzAmma(w http.ResponseWriter, r *http.Request) {
	ta := queryTA(r)
	status := r.URL.Query().Get("status")
	if status != "" && status != "selesai" && status != "belum" {
		writeJSONError(w, "filter status tidak valid", http.StatusBadRequest)
		return
	}
	evaluasi := r.URL.Query().Get("evaluasi")
	if evaluasi != "" && evaluasi != "lulus" && evaluasi != "her" && evaluasi != "tidak_lulus" {
		writeJSONError(w, "filter evaluasi tidak valid", http.StatusBadRequest)
		return
	}
	var bagianID *int
	if v := r.URL.Query().Get("bagian_id"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			writeJSONError(w, "bagian_id tidak valid", http.StatusBadRequest)
			return
		}
		bagianID = &n
	}
	bagianIDs, ok := tambahanBagianIDs(w, r)
	if !ok {
		return
	}
	rows, err := models.GetJuzAmma(r.Context(), ta, bagianID, status, evaluasi, bagianIDs)
	if err != nil {
		writeJSONError(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	writeJSON(w, rows)
}

// SaveJuzAmma — POST /api/penilaian-tambahan/juz-amma (pimpinan)
// Body: {tahun_ajaran, santri_id, surat_no?, setor?, evaluasi?, status?}
func SaveJuzAmma(w http.ResponseWriter, r *http.Request) {
	var req models.JuzAmmaInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "format data tidak valid", http.StatusBadRequest)
		return
	}
	if req.TahunAjaran == "" {
		req.TahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}
	if req.Evaluasi != nil && *req.Evaluasi != "" && *req.Evaluasi != "lulus" && *req.Evaluasi != "her" && *req.Evaluasi != "tidak_lulus" {
		writeJSONError(w, "evaluasi harus lulus/her/tidak_lulus", http.StatusBadRequest)
		return
	}
	if req.Status != nil && *req.Status != "" && *req.Status != "selesai" && *req.Status != "belum" {
		writeJSONError(w, "status harus selesai/belum", http.StatusBadRequest)
		return
	}
	if err := models.SaveJuzAmma(r.Context(), req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "success", "message": "Setoran Juz Amma tersimpan"})
}

// GetKompetensi — GET /api/penilaian-tambahan/kompetensi
// Query: tahun_ajaran, kategori (ubq|praktik|kitab), hasil (lulus|her|tidak_lulus), bagian_id
func GetKompetensi(w http.ResponseWriter, r *http.Request) {
	ta := queryTA(r)
	kategori := r.URL.Query().Get("kategori")
	if kategori != "" && kategori != "ubq" && kategori != "praktik" && kategori != "kitab" {
		writeJSONError(w, "filter kategori tidak valid", http.StatusBadRequest)
		return
	}
	hasil := r.URL.Query().Get("hasil")
	if hasil != "" && hasil != "lulus" && hasil != "her" && hasil != "tidak_lulus" {
		writeJSONError(w, "filter hasil tidak valid", http.StatusBadRequest)
		return
	}
	var bagianID *int
	if v := r.URL.Query().Get("bagian_id"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			writeJSONError(w, "bagian_id tidak valid", http.StatusBadRequest)
			return
		}
		bagianID = &n
	}
	bagianIDs, ok := tambahanBagianIDs(w, r)
	if !ok {
		return
	}
	rows, err := models.GetKompetensi(r.Context(), ta, kategori, hasil, bagianID, bagianIDs)
	if err != nil {
		writeJSONError(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	writeJSON(w, rows)
}

// SaveKompetensi — POST /api/penilaian-tambahan/kompetensi (pimpinan)
func SaveKompetensi(w http.ResponseWriter, r *http.Request) {
	var req models.KompetensiInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "format data tidak valid", http.StatusBadRequest)
		return
	}
	if req.TahunAjaran == "" {
		req.TahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}
	if req.Kategori != "ubq" && req.Kategori != "praktik" && req.Kategori != "kitab" {
		writeJSONError(w, "kategori harus ubq/praktik/kitab", http.StatusBadRequest)
		return
	}
	if req.Hasil != "lulus" && req.Hasil != "her" && req.Hasil != "tidak_lulus" {
		writeJSONError(w, "hasil harus lulus/her/tidak_lulus", http.StatusBadRequest)
		return
	}
	if err := models.SaveKompetensi(r.Context(), req); err != nil {
		if errors.Is(err, models.ErrKompetensiTidakBerlaku) {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "success", "message": "Nilai kompetensi tersimpan"})
}
