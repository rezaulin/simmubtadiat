package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// GetAbsensiPengajarKuartal returns all teachers (mustahiq + munawwib) with their
// quarterly attendance. Teachers without records still appear (zeros). Used for both
// the Input page and the Rekap page. Filter by tingkatan_id, kelas_id, tahun_ajaran.
func GetAbsensiPengajarKuartal(w http.ResponseWriter, r *http.Request) {
	if _, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession); !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	tingkatanID, _ := strconv.Atoi(r.URL.Query().Get("tingkatan_id"))
	kelasID, _ := strconv.Atoi(r.URL.Query().Get("kelas_id"))

	// Butir D — validasi cakupan per role di LEVEL API.
	// Tanpa tingkatan_id, models.GetAbsensiPengajarKuartal mengembalikan
	// SELURUH pengajar; sebelumnya UI hanya membatasi dropdown sehingga
	// permintaan langsung (curl/DevTools) dengan tingkatan lain lolos.
	if absensiPengajarScopeView(w, r, tingkatanID, kelasID) {
		return
	}

	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	if tahunAjaran == "" {
		http.Error(w, "tahun_ajaran wajib diisi", http.StatusBadRequest)
		return
	}

	res, err := models.GetAbsensiPengajarKuartal(r.Context(), tingkatanID, kelasID, tahunAjaran)
	if err != nil {
		http.Error(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	writeJSON(w, res)
}

// absensiPengajarScopeView membatasi akses BACA Rekap/Input Absensi Pengajar
// sesuai cakupan pengguna, dan mengembalikan true bila permintaan sudah
// ditolak (respons sudah ditulis).
//
// Cakupan penuh  : pimpinan, admin, tim_rapot, muroqib (sama dengan
//                  models.GetBagianForPenilaian).
// Cakupan terbatas: mustahiq  -> tingkatan+kelas penugasannya (angkatannya)
//                   mufatish -> tingkatan+kelas yang dibawahi
//
// Role terbatas wajib memilih tingkatan: tanpa tingkatan_id endpoint ini
// mengembalikan seluruh pengajar. Tingkatan di luar cakupan -> 403.
func absensiPengajarScopeView(w http.ResponseWriter, r *http.Request, tingkatanID, kelasID int) bool {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return true
	}
	for _, role := range user.Roles {
		if role == "pimpinan" || role == "admin" || role == "tim_rapot" || role == "muroqib" {
			return false
		}
	}
	if tingkatanID == 0 {
		writeJSONError(w, "Pilih tingkatan sesuai cakupan Anda", http.StatusForbidden)
		return true
	}
	bagians, err := models.GetBagianForPenilaian(r.Context(), user.Roles, user.PengajarID)
	if err != nil {
		writeJSONError(w, internalError("", err), http.StatusInternalServerError)
		return true
	}
	for _, b := range bagians {
		if b.TingkatanID == tingkatanID && (kelasID == 0 || b.KelasID == kelasID) {
			return false
		}
	}
	writeJSONError(w, "Tingkatan/kelas tersebut di luar cakupan Anda", http.StatusForbidden)
	return true
}

// SaveAbsensiPengajarKuartal upserts quarterly attendance numbers for a batch of teachers.
func SaveAbsensiPengajarKuartal(w http.ResponseWriter, r *http.Request) {
	if _, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession); !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		TahunAjaran string                            `json:"tahun_ajaran"`
		Data        []models.AbsensiPengajarKuartal `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.TahunAjaran == "" {
		http.Error(w, "tahun_ajaran wajib diisi", http.StatusBadRequest)
		return
	}

	if err := models.SaveAbsensiPengajarKuartal(r.Context(), req.TahunAjaran, req.Data); err != nil {
		http.Error(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "success", "message": "Absensi pengajar berhasil disimpan"})
}
