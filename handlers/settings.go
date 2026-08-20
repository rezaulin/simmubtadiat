package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mubtadiaat/app/config"
	"github.com/mubtadiaat/app/models"
)

// GetRaportSettings retrieves the current settings for Raport
func GetRaportSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := models.GetRaportSettings(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(settings)
}

// UpdateRaportSettings updates the default print settings for Raport
func UpdateRaportSettings(w http.ResponseWriter, r *http.Request) {
	var req models.RaportSettings

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Fetch existing values to preserve them since frontend doesn't send them
	var currentLogo, currentUrutan string
	err := config.DB.QueryRow(r.Context(), "SELECT COALESCE(logo_url, ''), COALESCE(urutan_kolom_identitas::text, '[]') FROM rapot_settings ORDER BY id DESC LIMIT 1").Scan(&currentLogo, &currentUrutan)
	if err != nil {
		currentUrutan = "[]"
	}

	if req.LogoURL != "" {
		currentLogo = req.LogoURL
	}
	if req.UrutanKolomIdentitas != "" {
		currentUrutan = req.UrutanKolomIdentitas
	}
	if currentUrutan == "" {
		currentUrutan = "[]"
	}

	_, err = config.DB.Exec(r.Context(),
		`INSERT INTO rapot_settings (header_baris_1, header_baris_2, header_baris_3, nama_kepala, nip_kepala, logo_url, urutan_kolom_identitas)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		req.HeaderBaris1, req.HeaderBaris2, req.HeaderBaris3, req.NamaKepala, req.NIPKepala, currentLogo, currentUrutan)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Pengaturan raport berhasil diperbarui"})
}

// GetMudirTingkatan mengembalikan daftar tingkatan beserta nama mudirnya (untuk Settings).
func GetMudirTingkatan(w http.ResponseWriter, r *http.Request) {
	list, err := models.GetMudirTingkatan(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(list)
}

// UpdateMudirTingkatan menyimpan nama mudir untuk satu tingkatan.
func UpdateMudirTingkatan(w http.ResponseWriter, r *http.Request) {
	var req models.MudirTingkatan
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.TingkatanID == 0 {
		http.Error(w, "tingkatan_id wajib diisi", http.StatusBadRequest)
		return
	}
	if err := models.UpsertMudirTingkatan(r.Context(), req.TingkatanID, req.NamaMudir); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Nama mudir berhasil disimpan"})
}

// UpdateMudirTandaTangan menyimpan/menghapus tanda tangan digital mudir (data URL PNG).
// Batas ukuran ~700KB data URL untuk mencegah payload berlebihan.
func UpdateMudirTandaTangan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TingkatanID int    `json:"tingkatan_id"`
		TandaTangan string `json:"tanda_tangan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.TingkatanID == 0 {
		http.Error(w, "tingkatan_id wajib diisi", http.StatusBadRequest)
		return
	}
	if len(req.TandaTangan) > 700*1024 {
		http.Error(w, "Gambar tanda tangan terlalu besar", http.StatusBadRequest)
		return
	}
	if req.TandaTangan != "" && !strings.HasPrefix(req.TandaTangan, "data:image/") {
		http.Error(w, "Format tanda tangan tidak valid", http.StatusBadRequest)
		return
	}
	if err := models.UpsertMudirTandaTangan(r.Context(), req.TingkatanID, req.TandaTangan); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Tanda tangan tersimpan"})
}

// GetSettingsUmum retrieves general settings
func GetSettingsUmum(w http.ResponseWriter, r *http.Request) {
	ta := models.GetTahunAjaranAktif(r.Context())
	th := models.GetTahunHijriAktif(r.Context())
	json.NewEncoder(w).Encode(map[string]string{
		"tahun_ajaran_aktif": ta,
		"tahun_hijri_aktif":  th,
	})
}

// UpdateSettingsUmum updates general settings
func UpdateSettingsUmum(w http.ResponseWriter, r *http.Request) {
	var req map[string]string
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ta, ok := req["tahun_ajaran_aktif"]
	if !ok || ta == "" {
		http.Error(w, "tahun_ajaran_aktif wajib diisi", http.StatusBadRequest)
		return
	}

	_, err := config.DB.Exec(r.Context(), `
		INSERT INTO settings (key, value) VALUES ('tahun_ajaran_aktif', $1) 
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
	`, ta)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Simpan tahun Hijri aktif (opsional)
	if th, ok := req["tahun_hijri_aktif"]; ok && th != "" {
		_, _ = config.DB.Exec(r.Context(), `
			INSERT INTO settings (key, value) VALUES ('tahun_hijri_aktif', $1)
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
		`, th)
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Pengaturan umum berhasil disimpan"})
}
