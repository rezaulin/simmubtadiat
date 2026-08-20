package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mubtadiaat/app/config"
	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// absensiScopeGuardBagianEdit menolak akses save absensi mufatish ke bagian di luar cakupannya.
func absensiScopeGuardBagianEdit(w http.ResponseWriter, r *http.Request, bagianID int) bool {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	isGlobal := false
	if ok {
		for _, r := range user.Roles {
			if r == "pimpinan" || r == "admin" || r == "muroqib" {
				isGlobal = true
				break
			}
		}
	}
	if !ok || isGlobal {
		return false
	}
	allowed, err := models.CanEditAbsensiBagian(r.Context(), user.Roles, user.PengajarID, bagianID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return true
	}
	if !allowed {
		writeJSONError(w, "Anda tidak memiliki akses edit absensi ke kelas ini", http.StatusForbidden)
		return true
	}
	return false
}

// GET /api/absensi-manual/santri?bagian_id=X&tahun_hijri=1447
func GetAbsensiManualSantri(w http.ResponseWriter, r *http.Request) {
	bagianID, _ := strconv.Atoi(r.URL.Query().Get("bagian_id"))
	tahunHijri, _ := strconv.Atoi(r.URL.Query().Get("tahun_hijri"))
	if bagianID == 0 || tahunHijri == 0 {
		http.Error(w, "bagian_id dan tahun_hijri wajib", http.StatusBadRequest)
		return
	}
	data, err := models.GetAbsensiManualBulanan(r.Context(), bagianID, tahunHijri)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if data == nil {
		data = []models.AbsensiManualBulanan{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// POST /api/absensi-manual/santri
func SaveAbsensiManualSantri(w http.ResponseWriter, r *http.Request) {
	var entries []models.AbsensiManualBulanan
	if err := json.NewDecoder(r.Body).Decode(&entries); err != nil {
		http.Error(w, "body tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	if len(entries) > 0 {
		// Asumsi semua santri di body ini berada dalam bagian yang sama.
		// Dapatkan bagian_id santri pertama untuk check scope.
		var bagianID int
		err := config.DB.QueryRow(r.Context(), "SELECT bagian_id FROM santri WHERE id = $1", entries[0].SantriID).Scan(&bagianID)
		if err == nil {
			if absensiScopeGuardBagianEdit(w, r, bagianID) {
				return
			}
		}
	}

	saved, deleted, err := models.SaveAbsensiManualBulanan(r.Context(), entries)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"saved": saved, "deleted": deleted})
}

// GET /api/absensi-manual/pengajar?tahun_hijri=1447&bagian_id=X
func GetAbsensiManualPengajar(w http.ResponseWriter, r *http.Request) {
	tahunHijri, _ := strconv.Atoi(r.URL.Query().Get("tahun_hijri"))
	bagianID, _ := strconv.Atoi(r.URL.Query().Get("bagian_id"))
	tingkatanID, _ := strconv.Atoi(r.URL.Query().Get("tingkatan_id"))
	kelasID, _ := strconv.Atoi(r.URL.Query().Get("kelas_id"))

	if tahunHijri == 0 {
		http.Error(w, "tahun_hijri wajib", http.StatusBadRequest)
		return
	}
	data, err := models.GetAbsensiManualPengajarBulanan(r.Context(), tahunHijri, bagianID, tingkatanID, kelasID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if data == nil {
		data = []models.AbsensiManualPengajarBulanan{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// POST /api/absensi-manual/pengajar?bagian_id=X
func SaveAbsensiManualPengajar(w http.ResponseWriter, r *http.Request) {
	bagianID, _ := strconv.Atoi(r.URL.Query().Get("bagian_id"))
	if bagianID > 0 {
		if absensiScopeGuardBagianEdit(w, r, bagianID) {
			return
		}
	}

	var entries []models.AbsensiManualPengajarBulanan
	if err := json.NewDecoder(r.Body).Decode(&entries); err != nil {
		http.Error(w, "body tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	saved, deleted, err := models.SaveAbsensiManualPengajarBulanan(r.Context(), entries)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"saved": saved, "deleted": deleted})
}
