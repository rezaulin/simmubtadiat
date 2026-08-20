package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mubtadiaat/app/config"
	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// hariIndonesia maps Go's time.Weekday to the Indonesian day names stored in
// the jadwal_pelajaran.hari column (note: Sunday = "Ahad", Friday = "Jumat").
var hariIndonesia = map[time.Weekday]string{
	time.Sunday:    "Ahad",
	time.Monday:    "Senin",
	time.Tuesday:   "Selasa",
	time.Wednesday: "Rabu",
	time.Thursday:  "Kamis",
	time.Friday:    "Jumat",
	time.Saturday:  "Sabtu",
}

type JadwalPelajaran struct {
	ID         int    `json:"id"`
	BagianID   int    `json:"bagian_id"`
	MapelID    int    `json:"mapel_id"`
	PengajarID *int   `json:"pengajar_id"`
	Hari       string `json:"hari"`
	JamMulai   string `json:"jam_mulai"`
	JamSelesai string `json:"jam_selesai"`
	// Join fields
	NamaMapel    string `json:"nama_mapel,omitempty"`
	NamaPengajar string `json:"nama_pengajar,omitempty"`
}

func GetJadwalByBagian(w http.ResponseWriter, r *http.Request) {
	bagianIDStr := r.URL.Query().Get("bagian_id")
	if bagianIDStr == "" {
		http.Error(w, "bagian_id is required", http.StatusBadRequest)
		return
	}

	query := `SELECT j.id, j.bagian_id, j.mapel_id, j.pengajar_id, j.hari,
	                 to_char(j.jam_mulai, 'HH24:MI'), to_char(j.jam_selesai, 'HH24:MI'), m.nama_mapel, p.nama
	          FROM jadwal_pelajaran j
	          JOIN mata_pelajaran m ON j.mapel_id = m.id

	          LEFT JOIN pengajar p ON j.pengajar_id = p.id
	          WHERE j.bagian_id=$1 ORDER BY j.hari, j.jam_mulai`
	rows, err := config.DB.Query(context.Background(), query, bagianIDStr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var jadwals []JadwalPelajaran
	for rows.Next() {
		var j JadwalPelajaran
		var namaPengajar *string
		if err := rows.Scan(&j.ID, &j.BagianID, &j.MapelID, &j.PengajarID, &j.Hari, &j.JamMulai, &j.JamSelesai, &j.NamaMapel, &namaPengajar); err != nil {
			continue
		}
		if namaPengajar != nil {
			j.NamaPengajar = *namaPengajar
		}
		jadwals = append(jadwals, j)
	}

	json.NewEncoder(w).Encode(jadwals)
}

func CreateJadwal(w http.ResponseWriter, r *http.Request) {
	var j JadwalPelajaran
	if err := json.NewDecoder(r.Body).Decode(&j); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := config.DB.QueryRow(context.Background(),
		"INSERT INTO jadwal_pelajaran (bagian_id, mapel_id, pengajar_id, hari, jam_mulai, jam_selesai) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
		j.BagianID, j.MapelID, j.PengajarID, j.Hari, j.JamMulai, j.JamSelesai).Scan(&j.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(j)
}

func UpdateJadwal(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	var j JadwalPelajaran
	if err := json.NewDecoder(r.Body).Decode(&j); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := config.DB.Exec(context.Background(),
		"UPDATE jadwal_pelajaran SET mapel_id=$1, pengajar_id=$2, hari=$3, jam_mulai=$4, jam_selesai=$5 WHERE id=$6",
		j.MapelID, j.PengajarID, j.Hari, j.JamMulai, j.JamSelesai, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func DeleteJadwal(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(chi.URLParam(r, "id"))
	_, err := config.DB.Exec(context.Background(), "DELETE FROM jadwal_pelajaran WHERE id=$1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// JadwalHariIni represents a schedule entry today for the logged-in pengajar,
// enriched with the bagian (class room) info needed to load attendance.
type JadwalHariIni struct {
	ID         int    `json:"id"`
	BagianID   int    `json:"bagian_id"`
	NamaBagian string `json:"nama_bagian"`
	Tingkatan  string `json:"tingkatan,omitempty"`
	Kelas      string `json:"kelas,omitempty"`
	MapelID    int    `json:"mapel_id"`
	NamaMapel  string `json:"nama_mapel"`
	Hari       string `json:"hari"`
	JamMulai   string `json:"jam_mulai"`
	JamSelesai string `json:"jam_selesai"`
}

// fetchJadwalHariIni is the data-access seam used by GetJadwalSayaHariIni. It
// resolves today's schedule rows for exactly one pengajar (the logged-in
// teacher). It is a package-level variable so tests can inject an in-memory
// data source that simulates the database without a live connection. In
// production it defaults to the pgx-backed implementation below.
var fetchJadwalHariIni = queryJadwalHariIniFromDB

// queryJadwalHariIniFromDB is the production implementation of the schedule
// lookup. The RBAC scoping is enforced here by the `WHERE j.pengajar_id = $1`
// clause: only rows owned by the given pengajar are ever returned.
func queryJadwalHariIniFromDB(ctx context.Context, pengajarID int, hari string) ([]JadwalHariIni, error) {
	query := `SELECT j.id, j.bagian_id, b.nama_bagian, t.nama, k.nama,
	                 j.mapel_id, m.nama_mapel, j.hari,
	                 to_char(j.jam_mulai, 'HH24:MI'), to_char(j.jam_selesai, 'HH24:MI')
	          FROM jadwal_pelajaran j
	          JOIN bagian b ON j.bagian_id = b.id

	          JOIN mata_pelajaran m ON j.mapel_id = m.id
	          LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
	          LEFT JOIN kelas k ON b.kelas_id = k.id
	          WHERE j.pengajar_id = $1 AND j.hari = $2
	          ORDER BY j.jam_mulai`
	rows, err := config.DB.Query(ctx, query, pengajarID, hari)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jadwals := []JadwalHariIni{}
	for rows.Next() {
		var j JadwalHariIni
		var tingkatan, kelas *string
		if err := rows.Scan(&j.ID, &j.BagianID, &j.NamaBagian, &tingkatan, &kelas,
			&j.MapelID, &j.NamaMapel, &j.Hari, &j.JamMulai, &j.JamSelesai); err != nil {
			continue
		}
		if tingkatan != nil {
			j.Tingkatan = *tingkatan
		}
		if kelas != nil {
			j.Kelas = *kelas
		}
		jadwals = append(jadwals, j)
	}

	return jadwals, nil
}

// GetJadwalSayaHariIni returns the schedule entries for the current day that
// belong to the logged-in pengajar. Used by the Absensi page to auto-load the
// classes a teacher must attend today without manual filtering.
//
// RBAC: the pengajar identity is taken exclusively from the authenticated
// session (user.PengajarID) and never from client-supplied input, so a teacher
// can only ever see their own schedule.
func GetJadwalSayaHariIni(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)

	resp := map[string]interface{}{
		"hari":   hariIndonesia[time.Now().Weekday()],
		"jadwal": []JadwalHariIni{},
	}

	// A pengajar identity is required to resolve today's schedule.
	if user.PengajarID == nil {
		json.NewEncoder(w).Encode(resp)
		return
	}

	hari := hariIndonesia[time.Now().Weekday()]

	jadwals, err := fetchJadwalHariIni(context.Background(), *user.PengajarID, hari)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	resp["jadwal"] = jadwals
	json.NewEncoder(w).Encode(resp)
}
