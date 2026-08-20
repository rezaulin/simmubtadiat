package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mubtadiaat/app/config"
	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// resolveTaSemester mengambil tahun_ajaran & semester dari query, dengan default
// tahun ajaran aktif. Semester wajib 1 atau 2.
func resolveTaSemester(r *http.Request) (string, int, bool) {
	ta := r.URL.Query().Get("tahun_ajaran")
	if ta == "" {
		ta = models.GetTahunAjaranAktif(r.Context())
	}
	sem, err := strconv.Atoi(r.URL.Query().Get("semester"))
	if err != nil || (sem != 1 && sem != 2) {
		return ta, 0, false
	}
	return ta, sem, true
}

// GetStatusPenilaian mengembalikan state kunci + progres konfirmasi bagian.
func GetStatusPenilaian(w http.ResponseWriter, r *http.Request) {
	ta, sem, ok := resolveTaSemester(r)
	if !ok {
		http.Error(w, "semester harus 1 atau 2", http.StatusBadRequest)
		return
	}
	res, err := models.GetPenilaianStatus(r.Context(), ta, sem)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

// OpenKoreksiHandler membuka masa koreksi (admin/pimpinan).
func OpenKoreksiHandler(w http.ResponseWriter, r *http.Request) {
	ta, sem, ok := resolveTaSemester(r)
	if !ok {
		http.Error(w, "semester harus 1 atau 2", http.StatusBadRequest)
		return
	}
	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if err := models.OpenKoreksi(r.Context(), ta, sem, user.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Masa koreksi dibuka"})
}

// ForceLockHandler mengunci paksa (admin/pimpinan).
func ForceLockHandler(w http.ResponseWriter, r *http.Request) {
	ta, sem, ok := resolveTaSemester(r)
	if !ok {
		http.Error(w, "semester harus 1 atau 2", http.StatusBadRequest)
		return
	}
	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if err := models.ForceLock(r.Context(), ta, sem, user.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Semester dikunci & nilai final digenerate"})
}

// UnlockHandler membuka kunci (admin/pimpinan).
func UnlockHandler(w http.ResponseWriter, r *http.Request) {
	ta, sem, ok := resolveTaSemester(r)
	if !ok {
		http.Error(w, "semester harus 1 atau 2", http.StatusBadRequest)
		return
	}
	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if err := models.Unlock(r.Context(), ta, sem, user.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Kunci dibuka, kembali ke masa koreksi"})
}

// ConfirmBagianHandler mencatat konfirmasi "sudah dikoreksi" untuk satu bagian.
// Mustahiq hanya boleh mengonfirmasi bagian yang diampunya; admin/pimpinan bebas.
func ConfirmBagianHandler(w http.ResponseWriter, r *http.Request) {
	ta, sem, ok := resolveTaSemester(r)
	if !ok {
		http.Error(w, "semester harus 1 atau 2", http.StatusBadRequest)
		return
	}
	var req struct {
		BagianID int `json:"bagian_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.BagianID <= 0 {
		http.Error(w, "bagian_id wajib", http.StatusBadRequest)
		return
	}

	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)

	pengajarID := 0
	if user.PengajarID != nil {
		pengajarID = *user.PengajarID
	}

	// Verifikasi kepemilikan bagian untuk mustahiq.
	if user.HasRole("mustahiq") {
		if user.PengajarID == nil {
			http.Error(w, "akun mustahiq tidak tertaut pengajar", http.StatusForbidden)
			return
		}
		var cnt int
		err := config.DB.QueryRow(r.Context(),
			`SELECT COUNT(1) FROM mustahiq_bagian WHERE bagian_id = $1 AND pengajar_id = $2`,
			req.BagianID, *user.PengajarID).Scan(&cnt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if cnt == 0 {
			http.Error(w, "akses ditolak: bukan mustahiq bagian ini", http.StatusForbidden)
			return
		}
	}

	if err := models.ConfirmBagian(r.Context(), ta, sem, req.BagianID, pengajarID, user.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Kembalikan status terbaru agar frontend tahu apakah sudah auto-terkunci.
	res, err := models.GetPenilaianStatus(r.Context(), ta, sem)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}
