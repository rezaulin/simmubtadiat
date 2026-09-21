package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// Users. Query opsional: role (staf|wali_santri|<peran>), q (cari), limit, offset.
func GetUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	role := q.Get("role")
	keyword := q.Get("q")

	limit := 25
	if v, err := strconv.Atoi(q.Get("limit")); err == nil && v > 0 && v <= 200 {
		limit = v
	}
	offset := 0
	if v, err := strconv.Atoi(q.Get("offset")); err == nil && v >= 0 {
		offset = v
	}

	items, total, err := models.GetAllUsers(r.Context(), role, keyword, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func CreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		models.User
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := models.CreateUser(r.Context(), req.User, req.Password); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "User berhasil dibuat"})
}

func UpdateUser(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	var u models.User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := models.UpdateUser(r.Context(), id, u); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "User berhasil diperbarui"})
}

func DeleteUser(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	if err := models.DeleteUser(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "User berhasil dihapus"})
}

// ResetPassword — POST /api/settings/users/{id}/reset-password
// Body: {"password":"..."}. Sandi wajib lolos validasi kompleksitas.
// Setelah reset, user WAJIB mengganti sandi sendiri saat login (lihat models.ResetPassword).
func ResetPassword(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	// Validate password complexity
	if ok, msg := middleware.ValidatePasswordComplexity(req.Password); !ok {
		http.Error(w, msg, http.StatusBadRequest)
		return
	}
	if err := models.ResetPassword(r.Context(), id, req.Password); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			http.Error(w, "User tidak ditemukan", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Password user berhasil direset"})
}

// ResetPasswordBulk — POST /api/settings/users/reset-password-bulk
// Body: {"ids":[1,2,3], "password":""} — password kosong = reset ke NIK anak.
// Partial: id yang bermasalah dilaporkan per-baris, sisanya tetap diproses.
func ResetPasswordBulk(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs      []int  `json:"ids"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Body tidak valid", http.StatusBadRequest)
		return
	}
	if len(req.IDs) == 0 {
		http.Error(w, "Pilih minimal satu pengguna", http.StatusBadRequest)
		return
	}
	if len(req.IDs) > 200 {
		http.Error(w, "Maksimal 200 pengguna per sekali reset", http.StatusBadRequest)
		return
	}

	pw := strings.TrimSpace(req.Password)
	// Sandi custom tetap harus lolos validasi kompleksitas. Mode NIK (kosong)
	// tidak divalidasi karena NIK bisa pendek (mis. "5555").
	if pw != "" {
		if ok, msg := middleware.ValidatePasswordComplexity(pw); !ok {
			http.Error(w, msg, http.StatusBadRequest)
			return
		}
	}

	results, err := models.ResetPasswordBulk(r.Context(), req.IDs, pw)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	sukses, gagal := 0, 0
	for _, res := range results {
		if res.Status == "sukses" {
			sukses++
		} else {
			gagal++
		}
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"sukses":  sukses,
		"gagal":   gagal,
		"results": results,
	})
}

// Dynamic Columns
func GetDynamicColumns(w http.ResponseWriter, r *http.Request) {
	table := r.URL.Query().Get("table")
	res, err := models.GetDynamicColumns(r.Context(), table)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(res)
}

func CreateDynamicColumn(w http.ResponseWriter, r *http.Request) {
	var dc models.DynamicColumn
	if err := json.NewDecoder(r.Body).Decode(&dc); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := models.CreateDynamicColumn(r.Context(), dc); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Kolom dinamis berhasil ditambahkan"})
}

func UpdateDynamicColumn(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	var dc models.DynamicColumn
	if err := json.NewDecoder(r.Body).Decode(&dc); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := models.UpdateDynamicColumn(r.Context(), id, dc); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Kolom dinamis berhasil diperbarui"})
}

func DeleteDynamicColumn(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	if err := models.DeleteDynamicColumn(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Kolom dinamis berhasil dihapus"})
}
