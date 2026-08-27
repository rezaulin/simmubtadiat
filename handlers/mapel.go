package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/config"
)

// Mapel merepresentasikan satu mata pelajaran pada sebuah kelas.
// NamaMapel dipakai sebagai nama fann (الفنون), NamaKitab sebagai nama kitab (الكتب الدراسية).
type Mapel struct {
	ID            int    `json:"id"`
	TingkatanID   int    `json:"tingkatan_id"`
	KelasID       int    `json:"kelas_id"`
	NamaMapel     string `json:"nama_mapel"`
	NamaKitab     string `json:"nama_kitab"`
	NamaIndo      string `json:"nama_indo"`
	Kategori      string `json:"kategori"`
	Urutan        int    `json:"urutan"`
	AktifKuartal  []int  `json:"aktif_kuartal"`
}

// GetMapelByKelas mengambil daftar mapel untuk satu kelas.
func GetMapelByKelas(w http.ResponseWriter, r *http.Request) {
	tingkatanIDStr := r.URL.Query().Get("tingkatan_id")
	kelasIDStr := r.URL.Query().Get("kelas_id")
	if tingkatanIDStr == "" || kelasIDStr == "" {
		http.Error(w, "tingkatan_id and kelas_id are required", http.StatusBadRequest)
		return
	}

	rows, err := config.DB.Query(context.Background(),
		`SELECT id, tingkatan_id, kelas_id, nama_mapel, COALESCE(nama_kitab, ''), COALESCE(nama_indo, ''), kategori, urutan, aktif_kuartal
		 FROM mata_pelajaran WHERE tingkatan_id=$1 AND kelas_id=$2 ORDER BY urutan ASC, id ASC`, tingkatanIDStr, kelasIDStr)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var mapels []Mapel
	for rows.Next() {
		var m Mapel
		var aktifJSON []byte
		if err := rows.Scan(&m.ID, &m.TingkatanID, &m.KelasID, &m.NamaMapel, &m.NamaKitab, &m.NamaIndo, &m.Kategori, &m.Urutan, &aktifJSON); err != nil {
			continue
		}
		if err := json.Unmarshal(aktifJSON, &m.AktifKuartal); err != nil {
			m.AktifKuartal = []int{1, 2, 3, 4} // fallback
		}
		mapels = append(mapels, m)
	}

	json.NewEncoder(w).Encode(mapels)
}

func CreateMapel(w http.ResponseWriter, r *http.Request) {
	var m Mapel
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if m.Kategori == "" {
		m.Kategori = "umum" // default
	}
	if len(m.AktifKuartal) == 0 {
		m.AktifKuartal = []int{1, 2, 3, 4} // default: semua kwartal
	}

	// Validasi: minimal 1 kwartal, dan hanya boleh 1-4.
	for _, k := range m.AktifKuartal {
		if k < 1 || k > 4 {
			http.Error(w, "aktif_kuartal hanya boleh berisi angka 1-4", http.StatusBadRequest)
			return
		}
	}

	aktifJSON, err := json.Marshal(m.AktifKuartal)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	err = config.DB.QueryRow(context.Background(),
		`INSERT INTO mata_pelajaran (tingkatan_id, kelas_id, nama_mapel, nama_kitab, nama_indo, kategori, urutan, aktif_kuartal)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
		m.TingkatanID, m.KelasID, m.NamaMapel, m.NamaKitab, m.NamaIndo, m.Kategori, m.Urutan, aktifJSON).Scan(&m.ID)

	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(m)
}

func UpdateMapel(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.Atoi(idStr)

	var m Mapel
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if len(m.AktifKuartal) == 0 {
		m.AktifKuartal = []int{1, 2, 3, 4}
	}

	// Validasi: minimal 1 kwartal, dan hanya boleh 1-4.
	for _, k := range m.AktifKuartal {
		if k < 1 || k > 4 {
			http.Error(w, "aktif_kuartal hanya boleh berisi angka 1-4", http.StatusBadRequest)
			return
		}
	}

	aktifJSON, err := json.Marshal(m.AktifKuartal)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = config.DB.Exec(context.Background(),
		`UPDATE mata_pelajaran SET nama_mapel=$1, nama_kitab=$2, nama_indo=$3, kategori=$4, urutan=$5, aktif_kuartal=$6 WHERE id=$7`,
		m.NamaMapel, m.NamaKitab, m.NamaIndo, m.Kategori, m.Urutan, aktifJSON, id)

	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func DeleteMapel(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, _ := strconv.Atoi(idStr)

	_, err := config.DB.Exec(context.Background(), "DELETE FROM mata_pelajaran WHERE id=$1", id)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}
