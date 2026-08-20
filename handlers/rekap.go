package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/mubtadiaat/app/models"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

func GetLogAbsensiPengajar(w http.ResponseWriter, r *http.Request) {
	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	tahunHijri, _ := strconv.Atoi(r.URL.Query().Get("tahun_hijri"))
	bulanHijri, _ := strconv.Atoi(r.URL.Query().Get("bulan_hijri"))

	if tahunAjaran == "" && tahunHijri == 0 {
		http.Error(w, "tahun_ajaran atau tahun_hijri required", http.StatusBadRequest)
		return
	}

	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var roles []string
	if len(user.Roles) > 0 {
		roles = user.Roles
	} else {
		roles = []string{user.Role}
	}

	res, err := models.GetRekapAbsensiPengajarManual(r.Context(), tahunAjaran, tahunHijri, bulanHijri, roles, user.PengajarID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func GetRekapAbsensiSiswaRentang(w http.ResponseWriter, r *http.Request) {
	bagianIDStr := r.URL.Query().Get("bagian_id")
	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	tahunHijri, _ := strconv.Atoi(r.URL.Query().Get("tahun_hijri"))
	bulanHijri, _ := strconv.Atoi(r.URL.Query().Get("bulan_hijri"))

	if bagianIDStr == "" {
		http.Error(w, "bagian_id required", http.StatusBadRequest)
		return
	}

	var bagianID int
	fmt.Sscanf(bagianIDStr, "%d", &bagianID)

	res, err := models.GetRekapAbsensiSiswaManual(r.Context(), bagianID, tahunAjaran, tahunHijri, bulanHijri)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

