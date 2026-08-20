package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// agendaInput adalah payload create/update agenda dari klien.
type agendaInput struct {
	Judul      string  `json:"judul"`
	Deskripsi  string  `json:"deskripsi"`
	TglMulai   string  `json:"tgl_mulai"`
	TglSelesai *string `json:"tgl_selesai"`
}

// isValidISODate memvalidasi string 'YYYY-MM-DD' sebagai tanggal kalender nyata
// (mis. 2024-02-30 ditolak). Mengikuti kontrak yang sama dengan parseAbsensiQuery
// di frontend agar backend & frontend sepakat.
func isValidISODate(s string) bool {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return false
	}
	// time.Parse menormalkan tanggal tak valid (mis. 02-30 → 03-01); pastikan
	// round-trip identik agar hanya tanggal kalender nyata yang lolos.
	return t.Format("2006-01-02") == s
}

// validateAgendaInput menormalkan & memvalidasi payload. Mengembalikan Agenda
// siap simpan dan pesan error (kosong bila valid).
func validateAgendaInput(in agendaInput) (models.Agenda, string) {
	judul := strings.TrimSpace(in.Judul)
	if judul == "" {
		return models.Agenda{}, "judul wajib diisi"
	}
	if !isValidISODate(in.TglMulai) {
		return models.Agenda{}, "tgl_mulai harus tanggal valid berformat YYYY-MM-DD"
	}
	var tglSelesai *string
	if in.TglSelesai != nil && strings.TrimSpace(*in.TglSelesai) != "" {
		ts := strings.TrimSpace(*in.TglSelesai)
		if !isValidISODate(ts) {
			return models.Agenda{}, "tgl_selesai harus tanggal valid berformat YYYY-MM-DD"
		}
		if ts < in.TglMulai {
			return models.Agenda{}, "tgl_selesai tidak boleh sebelum tgl_mulai"
		}
		tglSelesai = &ts
	}
	return models.Agenda{
		Judul:      judul,
		Deskripsi:  strings.TrimSpace(in.Deskripsi),
		TglMulai:   in.TglMulai,
		TglSelesai: tglSelesai,
	}, ""
}

// GetAgenda mengembalikan daftar agenda. Dengan query ?from=&to= (keduanya
// YYYY-MM-DD) mengembalikan agenda yang beririsan rentang tersebut; tanpa query
// mengembalikan agenda mendatang mulai hari ini (dibatasi 100 entri).
func GetAgenda(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")

	var (
		res []models.Agenda
		err error
	)
	if from != "" && to != "" {
		if !isValidISODate(from) || !isValidISODate(to) {
			writeJSONError(w, "parameter from/to harus tanggal valid YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		res, err = models.GetAgendaByRange(r.Context(), from, to)
	} else {
		today := time.Now().Format("2006-01-02")
		res, err = models.GetUpcomingAgenda(r.Context(), today, 100)
	}
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// CreateAgenda membuat agenda baru (pimpinan/admin). Pembuat diambil dari sesi.
func CreateAgenda(w http.ResponseWriter, r *http.Request) {
	var in agendaInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSONError(w, "payload tidak valid", http.StatusBadRequest)
		return
	}
	agenda, errMsg := validateAgendaInput(in)
	if errMsg != "" {
		writeJSONError(w, errMsg, http.StatusBadRequest)
		return
	}
	if user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession); ok {
		uid := user.ID
		agenda.DibuatOleh = &uid
	}

	created, err := models.CreateAgenda(r.Context(), agenda)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// UpdateAgenda memperbarui agenda berdasarkan id (pimpinan/admin).
func UpdateAgenda(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSONError(w, "id tidak valid", http.StatusBadRequest)
		return
	}
	var in agendaInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSONError(w, "payload tidak valid", http.StatusBadRequest)
		return
	}
	agenda, errMsg := validateAgendaInput(in)
	if errMsg != "" {
		writeJSONError(w, errMsg, http.StatusBadRequest)
		return
	}
	if err := models.UpdateAgenda(r.Context(), id, agenda); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"success"}`))
}

// DeleteAgenda menghapus agenda berdasarkan id (pimpinan/admin).
func DeleteAgenda(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSONError(w, "id tidak valid", http.StatusBadRequest)
		return
	}
	if err := models.DeleteAgenda(r.Context(), id); err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"success"}`))
}
