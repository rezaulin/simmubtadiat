package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/mubtadiaat/app/models"
)

func GenerateAm(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BagianID    int    `json:"bagian_id"`
		Semester    int    `json:"semester"`
		TahunAjaran string `json:"tahun_ajaran"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if penilaianScopeGuardBagianEdit(w, r, req.BagianID) {
		return
	}

	tahunAjaran := req.TahunAjaran
	if tahunAjaran == "" {
		tahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}

	// Nilai 'Am adalah rata-rata kelas per mapel, jadi dihitung per BAGIAN, bukan per siswi.
	if err := models.GenerateNilaiAm(r.Context(), req.BagianID, req.Semester, tahunAjaran); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Nilai Am berhasil dikalkulasi"})
}

func GenerateBayan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SantriID    int    `json:"santri_id"`
		TahunAjaran string `json:"tahun_ajaran"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if penilaianScopeGuardSantriEdit(w, r, []int{req.SantriID}) {
		return
	}

	tahunAjaran := req.TahunAjaran
	if tahunAjaran == "" {
		tahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}

	if err := models.GenerateAlBayan(r.Context(), req.SantriID, tahunAjaran); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Al-Bayan berhasil dikalkulasi"})
}
