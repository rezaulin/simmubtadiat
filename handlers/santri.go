package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/config"
	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// writeJSONError sends an error response as valid JSON so the frontend can
// always parse it with response.json().
func writeJSONError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"message": message})
}

// GetSantriAktif returns all active students
func GetSantriAktif(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	tingkatanID, _ := strconv.Atoi(r.URL.Query().Get("tingkatan"))
	filter := models.SantriFilter{
		ProvinsiKode:  r.URL.Query().Get("provinsi"),
		KabupatenKode: r.URL.Query().Get("kabupaten"),
		TingkatanID:   tingkatanID,
	}
	res, err := models.GetSantriAktif(r.Context(), user.Roles, user.ID, filter)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

// GetSantriByBagian returns active students for a specific bagian, authorized
// against the requesting user. Used by the attendance page so a subject teacher
// can load students for a class in their daily schedule.
func GetSantriByBagian(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	bagianID, err := strconv.Atoi(chi.URLParam(r, "bagianId"))
	if err != nil {
		writeJSONError(w, "bagian_id tidak valid", http.StatusBadRequest)
		return
	}
	res, err := models.GetSantriByBagian(r.Context(), bagianID, user.Roles, user.ID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func GetArsipSantri(w http.ResponseWriter, r *http.Request) {

	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	status := r.URL.Query().Get("status")
	tingkatanID, _ := strconv.Atoi(r.URL.Query().Get("tingkatan_id"))
	kelasID, _ := strconv.Atoi(r.URL.Query().Get("kelas_id"))
	bagianID, _ := strconv.Atoi(r.URL.Query().Get("bagian_id"))
	tahunAjaran := r.URL.Query().Get("tahun_ajaran")

	filter := models.SantriArsipFilter{
		Status:      status,
		TingkatanID: tingkatanID,
		KelasID:     kelasID,
		BagianID:    bagianID,
		TahunAjaran: tahunAjaran,
	}

	res, err := models.GetArsipSantri(r.Context(), user.Roles, user.ID, filter)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

// RegisterSantri creates a new student and automatically assigns them to their first Bagian
func RegisterSantri(w http.ResponseWriter, r *http.Request) {
	var req struct {
		models.Santri
		BagianAwalID int `json:"bagian_awal_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := models.CreateSantri(r.Context(), req.Santri, req.BagianAwalID); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Riwayat pendidikan berhasil ditambahkan"})
}

func AssignBagian(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SantriIDs []int `json:"santri_ids"`
		BagianID  int   `json:"bagian_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := models.AssignSantriToBagian(r.Context(), req.SantriIDs, req.BagianID); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func GetSantriByID(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	idStr := chi.URLParam(r, "id")
	res, err := models.GetSantriByID(r.Context(), idStr, user.Roles, user.ID)
	if err != nil {
		writeJSONError(w, "Data santri tidak ditemukan", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func UpdateSantri(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSONError(w, "ID santri tidak valid", http.StatusBadRequest)
		return
	}

	var s models.Santri
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		writeJSONError(w, "Data tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if s.NIK == "" || s.Nama == "" {
		writeJSONError(w, "NIK dan Nama wajib diisi", http.StatusBadRequest)
		return
	}

	if s.Stambuk != nil && *s.Stambuk == "" {
		s.Stambuk = nil
	}

	if err := models.UpdateSantri(r.Context(), id, s); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Data santri berhasil diperbarui"})
}

func DeleteSantri(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSONError(w, "ID santri tidak valid", http.StatusBadRequest)
		return
	}
	if err := models.DeleteSantri(r.Context(), id); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Data santri berhasil dihapus"})
}

func FixStambukSantri(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Cari santri yang stambuk-nya melebihi 10000 (karena ini inputan ngawur user)
	rows, err := config.DB.Query(ctx, `SELECT id, bagian_id FROM santri WHERE NULLIF(regexp_replace(COALESCE(stambuk, ''), '\D', '', 'g'), '')::int > 10000`)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var targets []struct {
		ID       int
		BagianID *int
	}
	for rows.Next() {
		var t struct {
			ID       int
			BagianID *int
		}
		if err := rows.Scan(&t.ID, &t.BagianID); err == nil {
			targets = append(targets, t)
		}
	}

	count := 0
	for _, t := range targets {
		// Kosongkan stambuk
		_, _ = config.DB.Exec(ctx, `UPDATE santri SET stambuk = NULL WHERE id = $1`, t.ID)
		if t.BagianID != nil && *t.BagianID > 0 {
			var tingkatanID int
			err := config.DB.QueryRow(ctx, `SELECT tingkatan_id FROM bagian WHERE id = $1`, *t.BagianID).Scan(&tingkatanID)
			if err == nil && tingkatanID > 0 {
				_ = models.AssignStambukTingkatan(ctx, []int{t.ID}, tingkatanID)
			}
		}
		count++
	}

	json.NewEncoder(w).Encode(map[string]any{"status": "success", "message": "Stambuk berhasil diperbaiki", "jumlah_diperbaiki": count})
}
