package handlers

// Handler untuk API Penilaian Tambahan (tab-tab baru di halaman Penilaian).
// Baca: pimpinan + mufatish + mustahiq (dibatasi cakupan bagian) [+ wali, fase 5]
// Tulis: pimpinan saja (keputusan owner).

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
	"github.com/xuri/excelize/v2"
)

// parseFilterBagian: baca query tingkatan/kelas/bagian_id — filter cascading
// "Tingkatan → Kelas → Bagian" utk 3 fitur nilai tambahan (kosong = semua).
// ok=false kalau bagian_id tidak valid.
func parseFilterBagian(r *http.Request) (models.FilterBagian, bool) {
	var f models.FilterBagian
	q := r.URL.Query()
	f.Tingkatan = strings.TrimSpace(q.Get("tingkatan"))
	f.Kelas = strings.TrimSpace(q.Get("kelas"))
	if v := q.Get("bagian_id"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			return f, false
		}
		f.BagianID = &n
	}
	return f, true
}

// tambahanBagianIDs mengembalikan ID bagian yang boleh dilihat user sesuai
// cakupan (pimpinan: semua; mustahiq/mufatish: kelas+tingkatan tugasannya).
func tambahanBagianIDs(w http.ResponseWriter, r *http.Request) ([]int, bool) {
	bagianIDs, _, ok := tambahanScope(w, r)
	return bagianIDs, ok
}

// tambahanScope menghitung cakupan baca tab tambahan:
//   - role biasa  → bagian sesuai cakupan, tanpa filter santri
//   - wali_santri → SEMUA bagian + filter santri HANYA anaknya (wali_santri_link)
//
// (keputusan owner: wali tidak pernah melihat data selain anaknya sendiri)
func tambahanScope(w http.ResponseWriter, r *http.Request) (bagianIDs []int, santriIDs []int, ok bool) {
	user, okUser := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !okUser {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return nil, nil, false
	}
	if containsStr(user.Roles, "wali_santri") {
		anak, err := models.WaliAnakSantriIDs(r.Context(), user.ID)
		if err != nil {
			writeJSONError(w, internalError("", err), http.StatusInternalServerError)
			return nil, nil, false
		}
		semua, err := models.GetBagian(r.Context())
		if err != nil {
			writeJSONError(w, internalError("", err), http.StatusInternalServerError)
			return nil, nil, false
		}
		ids := make([]int, 0, len(semua))
		for _, b := range semua {
			ids = append(ids, b.ID)
		}
		return ids, anak, true
	}
	bagians, err := models.GetBagianForPenilaian(r.Context(), user.Roles, user.PengajarID)
	if err != nil {
		writeJSONError(w, internalError("", err), http.StatusInternalServerError)
		return nil, nil, false
	}
	ids := make([]int, 0, len(bagians))
	for _, b := range bagians {
		ids = append(ids, b.ID)
	}
	return ids, nil, true
}

// containsStr: ada `s` dalam list?
func containsStr(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// yaTidak: bool → label Excel.
func yaTidak(b bool) string {
	if b {
		return "Ya"
	}
	return "Tidak"
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
	bagianIDs, santriIDs, ok := tambahanScope(w, r)
	if !ok {
		return
	}
	filter, okFilter := parseFilterBagian(r)
	if !okFilter {
		writeJSONError(w, "bagian_id tidak valid", http.StatusBadRequest)
		return
	}
	rows, err := models.GetBawahRata(r.Context(), ta, kuartal, dalamMasa, selesai, bagianIDs, santriIDs, filter)
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
	filter, okFilter := parseFilterBagian(r)
	if !okFilter {
		writeJSONError(w, "bagian_id tidak valid", http.StatusBadRequest)
		return
	}
	bagianIDs, santriIDs, ok := tambahanScope(w, r)
	if !ok {
		return
	}
	rows, err := models.GetJuzAmma(r.Context(), ta, filter, status, evaluasi, bagianIDs, santriIDs)
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
	filter, okFilter := parseFilterBagian(r)
	if !okFilter {
		writeJSONError(w, "bagian_id tidak valid", http.StatusBadRequest)
		return
	}
	bagianIDs, santriIDs, ok := tambahanScope(w, r)
	if !ok {
		return
	}
	rows, err := models.GetKompetensi(r.Context(), ta, kategori, hasil, filter, bagianIDs, santriIDs)
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

// ─── Fase 5: ekspor Excel + akses wali ─────────────────────────────────────

// WaliAnak — GET /api/penilaian-tambahan/wali/anak (khusus wali_santri).
// Return daftar anak (read-only) milik akun yang login.
func WaliAnak(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	rows, err := models.WaliAnakRows(r.Context(), user.ID)
	if err != nil {
		writeJSONError(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	writeJSON(w, rows)
}

// judulHasil: enum DB → label Indonesia utk file Excel.
func judulHasilEnum(h string) string {
	switch h {
	case "lulus":
		return "Lulus"
	case "her":
		return "Her"
	case "tidak_lulus":
		return "Tidak Lulus"
	case "selesai":
		return "Selesai"
	case "belum":
		return "Belum"
	}
	return ""
}

// judulKategori: ubq/praktik/kitab → label panjang.
func judulKategoriEnum(k string) string {
	switch k {
	case "ubq":
		return "Ujian Baca Al-Qur'an"
	case "praktik":
		return "Ujian Praktik"
	case "kitab":
		return "Ujian Baca Kitab"
	}
	return k
}

// ExportTambahan — GET /api/penilaian-tambahan/export?fitur=... (PIMPINAN ONLY).
// Cek role dilakukan DI BACKEND (bukan cuma menyembunyikan tombol —
// keputusan owner, pola ExportSantri/ExportPengajar).
func ExportTambahan(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !containsStr(user.Roles, "pimpinan") {
		writeJSONError(w, "Insufficient privileges", http.StatusForbidden)
		return
	}
	fitur := r.URL.Query().Get("fitur")
	if fitur != "bawah-rata" && fitur != "juz-amma" && fitur != "kompetensi" {
		writeJSONError(w, "fitur harus bawah-rata/juz-amma/kompetensi", http.StatusBadRequest)
		return
	}
	ta := queryTA(r)
	bagianIDs, santriIDs, okScope := tambahanScope(w, r)
	if !okScope {
		return
	}

	// parsing filter — sama dengan GET masing-masing fitur
	q := r.URL.Query()

	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	sheet := "Sheet1"

	tulis := func(judul string, headers []string, rows [][]any) {
		// Baris 1 = judul (di-merge, tebal); baris 2 = header; data mulai baris 3
		// (keputusan owner 2026-10-02: hasil download wajib punya judul).
		last, _ := excelize.CoordinatesToCellName(len(headers), 1)
		_ = f.MergeCell(sheet, "A1", last)
		f.SetCellValue(sheet, "A1", judul)
		if st, err := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Size: 13}}); err == nil {
			_ = f.SetCellStyle(sheet, "A1", "A1", st)
		}
		for i, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(i+1, 2)
			f.SetCellValue(sheet, cell, h)
		}
		for ri, row := range rows {
			for ci, v := range row {
				cell, _ := excelize.CoordinatesToCellName(ci+1, ri+3)
				f.SetCellValue(sheet, cell, v)
			}
		}
	}

	var namaFile string
	switch fitur {
	case "bawah-rata":
		kuartal := 1
		if v := q.Get("kuartal"); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil || n < 1 || n > 4 {
				writeJSONError(w, "kuartal tidak valid", http.StatusBadRequest)
				return
			}
			kuartal = n
		}
		dalamMasa, ok1 := parseBoolFilter(q.Get("dalam_masa"))
		selesai, ok2 := parseBoolFilter(q.Get("selesai"))
		if !ok1 || !ok2 {
			writeJSONError(w, "filter tidak valid", http.StatusBadRequest)
			return
		}
		filter, okFilter := parseFilterBagian(r)
		if !okFilter {
			writeJSONError(w, "bagian_id tidak valid", http.StatusBadRequest)
			return
		}
		data, err := models.GetBawahRata(r.Context(), ta, kuartal, dalamMasa, selesai, bagianIDs, santriIDs, filter)
		if err != nil {
			writeJSONError(w, internalError("", err), http.StatusInternalServerError)
			return
		}
		rows := make([][]any, 0, len(data))
		for i, b := range data {
			rows = append(rows, []any{i + 1, b.Bagian, b.Nama, kuartal,
				b.JumlahNilai, math.Round(b.Rata2*100) / 100,
				b.Konsekuensi, b.JenisTakziran,
				yaTidak(b.DalamMasa), yaTidak(b.Selesai)})
		}
		tulis("Nilai Siswi di Bawah Rata² 4,4",
			[]string{"No", "Bagian", "Nama Siswi", "Kuartal", "Jumlah Nilai",
				"Rata-rata", "Konsekuensi", "Jenis Takziran",
				"Dalam Masa Takziran", "Selesai Takziran"}, rows)
		namaFile = fmt.Sprintf("di-bawah-rata-%s.xlsx", ta)

	case "juz-amma":
		filter, okFilter := parseFilterBagian(r)
		if !okFilter {
			writeJSONError(w, "bagian_id tidak valid", http.StatusBadRequest)
			return
		}
		status := q.Get("status")
		if status != "" && status != "selesai" && status != "belum" {
			writeJSONError(w, "filter status tidak valid", http.StatusBadRequest)
			return
		}
		evaluasi := q.Get("evaluasi")
		if evaluasi != "" && evaluasi != "lulus" && evaluasi != "her" && evaluasi != "tidak_lulus" {
			writeJSONError(w, "filter evaluasi tidak valid", http.StatusBadRequest)
			return
		}
		data, err := models.GetJuzAmma(r.Context(), ta, filter, status, evaluasi, bagianIDs, santriIDs)
		if err != nil {
			writeJSONError(w, internalError("", err), http.StatusInternalServerError)
			return
		}
		rows := make([][]any, 0, len(data))
		for i, d := range data {
			disetor := 0
			for _, s := range d.Surat {
				if s.Setor {
					disetor++
				}
			}
			rows = append(rows, []any{i + 1, d.Bagian, d.Nama,
				disetor, d.JumlahSurat,
				judulHasilEnum(d.Evaluasi), judulHasilEnum(d.Status)})
		}
		tulis("Hasil Setoran Juz Amma",
			[]string{"No", "Bagian", "Nama Siswi", "Surat Disetor",
				"Jumlah Surat", "Evaluasi", "Selesai / Belum"}, rows)
		namaFile = fmt.Sprintf("setoran-juz-amma-%s.xlsx", ta)

	case "kompetensi":
		filter, okFilter := parseFilterBagian(r)
		if !okFilter {
			writeJSONError(w, "bagian_id tidak valid", http.StatusBadRequest)
			return
		}
		kategori := q.Get("kategori")
		if kategori != "" && kategori != "ubq" && kategori != "praktik" && kategori != "kitab" {
			writeJSONError(w, "filter kategori tidak valid", http.StatusBadRequest)
			return
		}
		hasil := q.Get("hasil")
		if hasil != "" && hasil != "lulus" && hasil != "her" && hasil != "tidak_lulus" {
			writeJSONError(w, "filter hasil tidak valid", http.StatusBadRequest)
			return
		}
		data, err := models.GetKompetensi(r.Context(), ta, kategori, hasil, filter, bagianIDs, santriIDs)
		if err != nil {
			writeJSONError(w, internalError("", err), http.StatusInternalServerError)
			return
		}
		rows := make([][]any, 0, len(data))
		for i, d := range data {
			rows = append(rows, []any{i + 1, d.Bagian, d.Nama,
				judulHasilEnum(d.Hasil)})
		}
		// kolom "Kategori Ujian" dihapus — kategori jadi JUDUL data
		// (keputusan owner 2026-10-02).
		judulKompetensi := "Hasil Ujian Kompetensi"
		if kategori != "" {
			judulKompetensi = "Hasil " + judulKategoriEnum(kategori)
		}
		tulis(judulKompetensi,
			[]string{"No", "Bagian", "Nama Siswi", "Hasil"}, rows)
		namaFile = fmt.Sprintf("nilai-kompetensi-%s.xlsx", ta)
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", namaFile))
	if err := f.Write(w); err != nil {
		http.Error(w, "Gagal menulis file Excel", http.StatusInternalServerError)
	}
}
