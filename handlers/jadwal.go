package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/mubtadiaat/app/config"
	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// hariIndonesia maps Go's time.Weekday to the Indonesian day names stored in
// jadwal_pelajaran.hari (Sunday = "Ahad", Friday = "Jumat").
var hariIndonesia = map[time.Weekday]string{
	time.Sunday:    "Ahad",
	time.Monday:    "Senin",
	time.Tuesday:   "Selasa",
	time.Wednesday: "Rabu",
	time.Thursday:  "Kamis",
	time.Friday:    "Jumat",
	time.Saturday:  "Sabtu",
}

// hariEfektif — hari yang berlaku di jadwal. Jumat LIBUR (keputusan client
// 2026-10-12) sehingga tidak menerima input dan tidak muncul di form.
var hariEfektif = []string{"Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Sabtu"}

var hariValid = map[string]bool{
	"Ahad": true, "Senin": true, "Selasa": true,
	"Rabu": true, "Kamis": true, "Sabtu": true,
}

// hissohLabel — label tampil; slot bukan jam melainkan urutan hissoh.
var hissohLabel = map[string]string{"ula": "Hissoh Ula", "tsaniyah": "Hissoh Tsaniyah"}

var hissohValid = map[string]bool{"ula": true, "tsaniyah": true}
var peranValid = map[string]bool{"mustahiq": true, "munawwib": true}

// orderByHariHissoh — urutan tampil: Ahad..Sabtu lalu Hissoh Ula dulu.
const orderByHariHissoh = `ORDER BY array_position(ARRAY['Ahad','Senin','Selasa','Rabu','Kamis','Sabtu']::text[], j.hari),
                 CASE j.hissoh WHEN 'ula' THEN 1 ELSE 2 END, m.urutan, m.id`

// resolvePengajarSQL — JOIN lateral-ish: nama guru BUKAN disimpan di jadwal,
// di-resolve dari penugasan TERKINI (mustahiq_bagian / pengajar_bagian) sesuai
// tahun ajaran aktif. Ganti orang di penugasan → nama jadwal ikut berganti.
const resolvePengajarSQL = `LEFT JOIN pengajar p ON p.id = (
	CASE j.peran
	  WHEN 'mustahiq' THEN (
	    SELECT mb.pengajar_id FROM mustahiq_bagian mb
	    WHERE mb.bagian_id = j.bagian_id AND mb.tahun_ajaran = $2
	    LIMIT 1)
	  WHEN 'munawwib' THEN (
	    SELECT pb.pengajar_id FROM pengajar_bagian pb
	    WHERE pb.bagian_id = j.bagian_id AND pb.peran = 'munawwib'
	      AND pb.tahun_ajaran = $2
	    LIMIT 1)
	END)`

type JadwalPelajaran struct {
	ID       int    `json:"id"`
	BagianID int    `json:"bagian_id"`
	MapelID  int    `json:"mapel_id"`
	Hari     string `json:"hari"`
	Hissoh   string `json:"hissoh"`
	Peran    string `json:"peran"`
	// Hasil resolve (bukan kolom DB):
	NamaKitab    string `json:"nama_kitab,omitempty"`
	NamaMapel    string `json:"nama_mapel,omitempty"`
	NamaPengajar string `json:"nama_pengajar"` // "" → frontend tampil "(kosong)"
	HissohLabel  string `json:"hissoh_label,omitempty"`
}

func hissohDisplay(h string) string {
	if l, ok := hissohLabel[h]; ok {
		return l
	}
	return ""
}

func GetJadwalByBagian(w http.ResponseWriter, r *http.Request) {
	bagianIDStr := r.URL.Query().Get("bagian_id")
	if bagianIDStr == "" {
		http.Error(w, "bagian_id is required", http.StatusBadRequest)
		return
	}
	ta := models.GetTahunAjaranAktif(r.Context())

	query := `SELECT j.id, j.bagian_id, j.hari, j.hissoh, j.mapel_id, j.peran,
	                 COALESCE(NULLIF(m.nama_kitab, ''), m.nama_mapel), m.nama_mapel,
	                 COALESCE(p.nama, '')
	          FROM jadwal_pelajaran j
	          JOIN mata_pelajaran m ON j.mapel_id = m.id
	          ` + resolvePengajarSQL + `
	          WHERE j.bagian_id = $1
	          ` + orderByHariHissoh
	rows, err := config.DB.Query(context.Background(), query, bagianIDStr, ta)
	if err != nil {
		http.Error(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	jadwals := []JadwalPelajaran{}
	for rows.Next() {
		var j JadwalPelajaran
		if err := rows.Scan(&j.ID, &j.BagianID, &j.Hari, &j.Hissoh, &j.MapelID,
			&j.Peran, &j.NamaKitab, &j.NamaMapel, &j.NamaPengajar); err != nil {
			continue
		}
		j.HissohLabel = hissohDisplay(j.Hissoh)
		jadwals = append(jadwals, j)
	}
	writeJSON(w, jadwals)
}

// GetJadwalPengajar — dropdown pengajar KHUSUS satu bagian: hanya mustahiq &
// munawwib yang sedang ditugaskan di bagian itu (tahun ajaran aktif). Client
// request: jangan tampilkan pengajar kelas lain.
func GetJadwalPengajar(w http.ResponseWriter, r *http.Request) {
	bagianIDStr := r.URL.Query().Get("bagian_id")
	if bagianIDStr == "" {
		http.Error(w, "bagian_id is required", http.StatusBadRequest)
		return
	}
	ta := models.GetTahunAjaranAktif(r.Context())

	query := `SELECT 'mustahiq', mb.pengajar_id, p.nama
	          FROM mustahiq_bagian mb JOIN pengajar p ON p.id = mb.pengajar_id
	          WHERE mb.bagian_id = $1 AND mb.tahun_ajaran = $2
	          UNION ALL
	          SELECT 'munawwib', pb.pengajar_id, p.nama
	          FROM pengajar_bagian pb JOIN pengajar p ON p.id = pb.pengajar_id
	          WHERE pb.bagian_id = $1 AND pb.peran = 'munawwib' AND pb.tahun_ajaran = $2`
	rows, err := config.DB.Query(context.Background(), query, bagianIDStr, ta)
	if err != nil {
		http.Error(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type opsi struct {
		Peran      string `json:"peran"`
		PengajarID int    `json:"pengajar_id"`
		Nama       string `json:"nama"`
	}
	opsis := []opsi{}
	for rows.Next() {
		var o opsi
		if err := rows.Scan(&o.Peran, &o.PengajarID, &o.Nama); err != nil {
			continue
		}
		opsis = append(opsis, o)
	}
	writeJSON(w, opsis)
}

// jadwalCreateReq — poin client: satu pengajar bisa dipilih BANYAK kitab
// sekaligus (mapel_ids) → jadi banyak baris jadwal.
type jadwalCreateReq struct {
	BagianID int    `json:"bagian_id"`
	Hari     string `json:"hari"`
	Hissoh   string `json:"hissoh"`
	Peran    string `json:"peran"`
	MapelIDs []int  `json:"mapel_ids"`
	// MapelIDLegacy — dukung payload update lama {mapel_id: n}.
	MapelIDLegacy int `json:"mapel_id"`
}

// validasiJadwal dasar: hari efektif (tanpa Jumat), hissoh, peran.
func validasiJadwal(hari, hissoh, peran string) string {
	if !hariValid[hari] {
		return "hari tidak valid (Jumat libur)"
	}
	if !hissohValid[hissoh] {
		return "hissoh tidak valid (ula/tsaniyah)"
	}
	if !peranValid[peran] {
		return "peran tidak valid (mustahiq/munawwib)"
	}
	return ""
}

// mapelMilikBagian — cek SEMUA kitab milik tingkatan+kelas dari bagian tsb
// (cegah nyelipin kitab kelas lain lewat request manual).
func mapelMilikBagian(ctx context.Context, bagianID int, mapelIDs []int) (bool, error) {
	var tID, kID int
	err := config.DB.QueryRow(ctx,
		`SELECT tingkatan_id, kelas_id FROM bagian WHERE id=$1`, bagianID).Scan(&tID, &kID)
	if err != nil {
		return false, err // sql.ErrNoRows → bagian tak ada
	}
	var n int
	err = config.DB.QueryRow(ctx,
		`SELECT count(DISTINCT id) FROM mata_pelajaran
		  WHERE id = ANY($1::int[]) AND tingkatan_id=$2 AND kelas_id=$3`,
		mapelIDs, tID, kID).Scan(&n)
	if err != nil {
		return false, err
	}
	// bandingkan dengan jumlah unik mapel_ids
	uniq := map[int]bool{}
	for _, id := range mapelIDs {
		uniq[id] = true
	}
	return n == len(uniq), nil
}

func CreateJadwal(w http.ResponseWriter, r *http.Request) {
	var req jadwalCreateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if msg := validasiJadwal(req.Hari, req.Hissoh, req.Peran); msg != "" {
		http.Error(w, msg, http.StatusBadRequest)
		return
	}
	if len(req.MapelIDs) == 0 {
		http.Error(w, "mapel_ids wajib diisi", http.StatusBadRequest)
		return
	}

	ok, err := mapelMilikBagian(context.Background(), req.BagianID, req.MapelIDs)
	if err != nil {
		http.Error(w, "bagian tidak ditemukan", http.StatusBadRequest)
		return
	}
	if !ok {
		http.Error(w, "ada kitab yang bukan milik kelas ini", http.StatusBadRequest)
		return
	}

	created := 0
	for _, mid := range req.MapelIDs {
		tag, err := config.DB.Exec(context.Background(),
			`INSERT INTO jadwal_pelajaran (bagian_id, hari, hissoh, mapel_id, peran)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (bagian_id, hari, hissoh, mapel_id, peran) DO NOTHING`,
			req.BagianID, req.Hari, req.Hissoh, mid, req.Peran)
		if err != nil {
			http.Error(w, internalError("", err), http.StatusInternalServerError)
			return
		}
		if tag.RowsAffected() > 0 {
			created++
		}
	}
	writeJSON(w, map[string]interface{}{"status": "success", "created": created})
}

func UpdateJadwal(w http.ResponseWriter, r *http.Request) {
	id, okID := parseIDParam(w, r, "id")
	if !okID {
		return
	}
	var req jadwalCreateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if msg := validasiJadwal(req.Hari, req.Hissoh, req.Peran); msg != "" {
		http.Error(w, msg, http.StatusBadRequest)
		return
	}
	_, err := config.DB.Exec(context.Background(),
		`UPDATE jadwal_pelajaran SET hari=$1, hissoh=$2, peran=$3, mapel_id=$4 WHERE id=$5`,
		req.Hari, req.Hissoh, req.Peran, req.MapelIDSafe(), id)
	if err != nil {
		http.Error(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "success"})
}

// MapelIDSafe — dukung payload update lama {mapel_id: n} tanpa mapel_ids.
func (j *jadwalCreateReq) MapelIDSafe() int {
	if len(j.MapelIDs) > 0 {
		return j.MapelIDs[0]
	}
	return j.MapelIDLegacy
}

func DeleteJadwal(w http.ResponseWriter, r *http.Request) {
	id, okID := parseIDParam(w, r, "id")
	if !okID {
		return
	}
	_, err := config.DB.Exec(context.Background(), "DELETE FROM jadwal_pelajaran WHERE id=$1", id)
	if err != nil {
		http.Error(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "success"})
}

// ── Jadwal saya hari ini (widget dashboard / absensi) ──────────────────────

// JadwalHariIni represents a schedule entry today for the logged-in pengajar,
// enriched with the bagian (class room) info needed to load attendance.
// Nama guru TIDAK disimpan di jadwal — kehadiran baris ini sendiri sudah
// membuktikan pemiliknya (resolve via penugasan di query bawah).
type JadwalHariIni struct {
	ID          int    `json:"id"`
	BagianID    int    `json:"bagian_id"`
	NamaBagian  string `json:"nama_bagian"`
	Tingkatan   string `json:"tingkatan,omitempty"`
	Kelas       string `json:"kelas,omitempty"`
	MapelID     int    `json:"mapel_id"`
	NamaMapel   string `json:"nama_mapel"` // tampil nama kitab
	Hari        string `json:"hari"`
	Hissoh      string `json:"hissoh"`
	Peran       string `json:"peran"`
	HissohLabel string `json:"hissoh_label"`
}

// fetchJadwalHariIni is the data-access seam used by GetJadwalSayaHariIni
// (package-level var so tests can inject a fake data source).
var fetchJadwalHariIni = queryJadwalHariIniFromDB

// queryJadwalHariIniFromDB — resolve jadwal hari ini untuk SATU pengajar:
// baris jadwal cocok kalau peran baris = peran penugasan pengajar tsb di
// bagian tersebut (tahun ajaran aktif). RBAC: identitas datang dari sesi,
// bukan input klien.
func queryJadwalHariIniFromDB(ctx context.Context, pengajarID int, hari string) ([]JadwalHariIni, error) {
	ta := models.GetTahunAjaranAktif(ctx)
	query := `SELECT j.id, j.bagian_id, b.nama_bagian, t.nama, k.nama,
	                 j.mapel_id, COALESCE(NULLIF(m.nama_kitab, ''), m.nama_mapel),
	                 j.hari, j.hissoh, j.peran
	          FROM jadwal_pelajaran j
	          JOIN bagian b ON j.bagian_id = b.id
	          JOIN mata_pelajaran m ON j.mapel_id = m.id
	          LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
	          LEFT JOIN kelas k ON b.kelas_id = k.id
	          WHERE j.hari = $2
	            AND (
	              (j.peran = 'mustahiq' AND EXISTS (
	                SELECT 1 FROM mustahiq_bagian mb
	                WHERE mb.bagian_id = j.bagian_id AND mb.pengajar_id = $1
	                  AND mb.tahun_ajaran = $3))
	              OR
	              (j.peran = 'munawwib' AND EXISTS (
	                SELECT 1 FROM pengajar_bagian pb
	                WHERE pb.bagian_id = j.bagian_id AND pb.pengajar_id = $1
	                  AND pb.peran = 'munawwib' AND pb.tahun_ajaran = $3))
	            )
	          ORDER BY CASE j.hissoh WHEN 'ula' THEN 1 ELSE 2 END, m.urutan, m.id`
	rows, err := config.DB.Query(ctx, query, pengajarID, hari, ta)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jadwals := []JadwalHariIni{}
	for rows.Next() {
		var j JadwalHariIni
		var tingkatan, kelas *string
		if err := rows.Scan(&j.ID, &j.BagianID, &j.NamaBagian, &tingkatan, &kelas,
			&j.MapelID, &j.NamaMapel, &j.Hari, &j.Hissoh, &j.Peran); err != nil {
			continue
		}
		if tingkatan != nil {
			j.Tingkatan = *tingkatan
		}
		if kelas != nil {
			j.Kelas = *kelas
		}
		j.HissohLabel = hissohDisplay(j.Hissoh)
		jadwals = append(jadwals, j)
	}
	return jadwals, nil
}

// GetJadwalSayaHariIni returns the schedule entries for the current day that
// belong to the logged-in pengajar. Used by the Absensi page & dashboard
// widget. RBAC: pengajar identity taken exclusively from the session.
func GetJadwalSayaHariIni(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)

	resp := map[string]interface{}{
		"hari":   hariIndonesia[time.Now().Weekday()],
		"jadwal": []JadwalHariIni{},
	}
	if user.PengajarID == nil {
		writeJSON(w, resp)
		return
	}

	jadwals, err := fetchJadwalHariIni(context.Background(), *user.PengajarID,
		hariIndonesia[time.Now().Weekday()])
	if err != nil {
		http.Error(w, internalError("", err), http.StatusInternalServerError)
		return
	}
	resp["jadwal"] = jadwals
	writeJSON(w, resp)
}
