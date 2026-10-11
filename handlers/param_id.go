package handlers

// Validasi parameter angka — solusi temuan M5/L1 audit 2026-09-29:
// 41 titik `strconv.Atoi` yang errornya dibuang (`id, _ :=`) membuat ID
// salah ketik menjadi 0 → filter dilewati (data lebih luas) atau
// PUT/DELETE balas "sukses" padahal 0 baris tersimpan (silent failure).

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// parseIDParam: baca {id} dari URL path. Wajib angka > 0 — selain itu
// balas 400 "id tidak valid" dan ok=false (pemanggil wajib return).
func parseIDParam(w http.ResponseWriter, r *http.Request, name string) (int, bool) {
	v, err := strconv.Atoi(chi.URLParam(r, name))
	if err != nil || v <= 0 {
		writeJSONError(w, "id tidak valid", http.StatusBadRequest)
		return 0, false
	}
	return v, true
}

// parseIntQuery: baca query param angka OPSIONAL. String kosong → 0
// (tetap berarti "tanpa filter" seperti perilaku lama); diisi tapi bukan
// angka → 400 (dulu diam-diam jadi 0 = filter kelewatan).
func parseIntQuery(w http.ResponseWriter, r *http.Request, name string) (int, bool) {
	s := r.URL.Query().Get(name)
	if s == "" {
		return 0, true
	}
	v, err := strconv.Atoi(s)
	if err != nil || v < 0 {
		writeJSONError(w, "parameter "+name+" tidak valid", http.StatusBadRequest)
		return 0, false
	}
	return v, true
}
