package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/mubtadiaat/app/config"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// AnakWali adalah ringkasan santri yang tertaut ke akun wali yang sedang login.
type AnakWali struct {
	ID           int     `json:"id"`
	Nama         string  `json:"nama"`
	Stambuk      string  `json:"stambuk"`
	NIK          string  `json:"nik"`
	Status       string  `json:"status"`
	FotoURL      *string `json:"foto_url"`
	Tingkatan    *string `json:"tingkatan_nama"`
	Kelas        *string `json:"kelas_nama"`
	Bagian       *string `json:"bagian_nama"`
}

// GetAnakWali mengembalikan daftar santri yang tertaut ke akun wali yang login.
// Untuk role selain wali_santri, daftar akan kosong.
func GetAnakWali(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := config.DB.Query(r.Context(),
		`SELECT s.id, s.nama, s.stambuk, s.nik, s.status, s.foto_url,
		        t.nama, k.nama, b.nama_bagian
		 FROM wali_santri_link wl
		 JOIN santri s ON s.id = wl.santri_id
		 LEFT JOIN bagian b ON s.bagian_id = b.id
		 LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		 LEFT JOIN kelas k ON b.kelas_id = k.id
		 WHERE wl.user_id = $1
		 ORDER BY s.nama`, user.ID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	list := []AnakWali{}
	for rows.Next() {
		var a AnakWali
		if err := rows.Scan(&a.ID, &a.Nama, &a.Stambuk, &a.NIK, &a.Status, &a.FotoURL,
			&a.Tingkatan, &a.Kelas, &a.Bagian); err != nil {
			writeJSONError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		list = append(list, a)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}
