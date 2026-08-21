package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/mubtadiaat/app/models"
)

// GetDataHealth mengembalikan laporan kesehatan data penilaian untuk tahun
// ajaran aktif. Hanya untuk pimpinan/admin — ditampilkan sebagai widget
// pemberitahuan di dashboard.
func GetDataHealth(w http.ResponseWriter, r *http.Request) {
	ta := models.GetTahunAjaranAktif(r.Context())
	if ta == "" {
		ta = r.URL.Query().Get("ta")
	}
	report, err := models.GetDataHealthReport(r.Context(), ta)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}
