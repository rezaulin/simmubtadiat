package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mubtadiaat/app/config"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// AnakWali adalah ringkasan santri yang tertaut ke akun wali yang sedang login.
type AnakWali struct {
	ID           int            `json:"id"`
	Nama         string         `json:"nama"`
	Stambuk      pgtype.Text    `json:"stambuk"`
	NIK          string         `json:"nik"`
	Status       string         `json:"status"`
	FotoURL      pgtype.Text    `json:"foto_url"`
	Tingkatan    pgtype.Text    `json:"tingkatan_nama"`
	Kelas        pgtype.Text    `json:"kelas_nama"`
	Bagian       pgtype.Text    `json:"bagian_nama"`
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

// GetCatatanAnakWali mengembalikan catatan (pelanggaran/prestasi) untuk anak wali yang login.
// Query: ?santri_id=X (wajib) — dibatasi cuma anak yang tertaut.
func GetCatatanAnakWali(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	if !ok {
		writeJSONError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	santriIDStr := r.URL.Query().Get("santri_id")
	if santriIDStr == "" {
		writeJSONError(w, "santri_id wajib", http.StatusBadRequest)
		return
	}

	santriID, err := strconv.Atoi(santriIDStr)
	if err != nil {
		writeJSONError(w, "santri_id tidak valid", http.StatusBadRequest)
		return
	}

	// Verify santri adalah anak wali ini
	var count int
	err = config.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM wali_santri_link WHERE user_id = $1 AND santri_id = $2`,
		user.ID, santriID).Scan(&count)
	if err != nil || count == 0 {
		writeJSONError(w, "Akses ditolak: bukan anak Anda", http.StatusForbidden)
		return
	}

	// Fetch catatan
	rows, err := config.DB.Query(r.Context(),
		`SELECT id, santri_id, jenis, tanggal, kategori, deskripsi, tahun_ajaran
		 FROM catatan_santri
		 WHERE santri_id = $1
		 ORDER BY tanggal DESC`, santriID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type CatatanItem struct {
		ID          int     `json:"id"`
		SantriID    int     `json:"santri_id"`
		Jenis       string  `json:"jenis"`
		Tanggal     *string `json:"tanggal"`
		Kategori    *string `json:"kategori"`
		Deskripsi   *string `json:"deskripsi"`
		TahunAjaran *string `json:"tahun_ajaran"`
	}

	var list []CatatanItem
	for rows.Next() {
		var c CatatanItem
		var tgl interface{}
		if err := rows.Scan(&c.ID, &c.SantriID, &c.Jenis, &tgl, &c.Kategori, &c.Deskripsi, &c.TahunAjaran); err != nil {
			continue
		}
		if tgl != nil {
			switch v := tgl.(type) {
			case time.Time:
				s := v.Format("2006-01-02")
				c.Tanggal = &s
			default:
				s := fmt.Sprintf("%v", v)
				c.Tanggal = &s
			}
		}
		list = append(list, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}
