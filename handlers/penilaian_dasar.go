package handlers

import (
	"encoding/json"
	"net/http"

	appMiddleware "github.com/mubtadiaat/app/middleware"
	"github.com/mubtadiaat/app/models"
)

// penilaianScopeGuardSantriEdit menolak akses bila mustahiq mencoba mengedit nilai
// santri di luar cakupan kelas+tingkatannya. Mengembalikan true bila akses
// ditolak (dan sudah menulis respons error). pimpinan/admin selalu lolos.
func penilaianScopeGuardSantriEdit(w http.ResponseWriter, r *http.Request, santriIDs []int) bool {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	isGlobal := false
	if ok {
		for _, r := range user.Roles {
			if r == "pimpinan" || r == "admin" {
				isGlobal = true
				break
			}
		}
	}
	if !ok || isGlobal {
		return false
	}
	for _, sid := range santriIDs {
		allowed, err := models.CanEditSantriPenilaian(r.Context(), user.Roles, user.PengajarID, sid)
		if err != nil {
			writeJSONError(w, err.Error(), http.StatusInternalServerError)
			return true
		}
		if !allowed {
			writeJSONError(w, "Anda tidak memiliki akses ke nilai santri di luar kelas Anda", http.StatusForbidden)
			return true
		}
	}
	return false
}

// penilaianScopeGuardBagianEdit menolak akses save mustahiq ke bagian di luar cakupannya.
func penilaianScopeGuardBagianEdit(w http.ResponseWriter, r *http.Request, bagianID int) bool {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	isGlobal := false
	if ok {
		for _, r := range user.Roles {
			if r == "pimpinan" || r == "admin" {
				isGlobal = true
				break
			}
		}
	}
	if !ok || isGlobal {
		return false
	}
	allowed, err := models.CanEditBagianPenilaian(r.Context(), user.Roles, user.PengajarID, bagianID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return true
	}
	if !allowed {
		writeJSONError(w, "Anda tidak memiliki akses edit ke kelas ini", http.StatusForbidden)
		return true
	}
	return false
}

// penilaianScopeGuardBagianView menolak akses view mufatish/mustahiq ke bagian di luar cakupannya.
func penilaianScopeGuardBagianView(w http.ResponseWriter, r *http.Request, bagianID int) bool {
	user, ok := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	isGlobal := false
	if ok {
		for _, r := range user.Roles {
			if r == "pimpinan" || r == "admin" || r == "tim_rapot" {
				isGlobal = true
				break
			}
		}
	}
	if !ok || isGlobal {
		return false
	}
	allowed, err := models.CanViewBagianPenilaian(r.Context(), user.Roles, user.PengajarID, bagianID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return true
	}
	if !allowed {
		writeJSONError(w, "Anda tidak memiliki akses ke kelas ini", http.StatusForbidden)
		return true
	}
	return false
}

// GetBagianPenilaian mengembalikan daftar bagian sesuai cakupan pengguna
// (pimpinan/admin: semua; mustahiq: kelas+tingkatan penugasannya).
func GetBagianPenilaian(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(appMiddleware.UserContextKey).(appMiddleware.UserSession)
	res, err := models.GetBagianForPenilaian(r.Context(), user.Roles, user.PengajarID)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// BulkInputKuartal saves an array of Kuartal scores
func BulkInputKuartal(w http.ResponseWriter, r *http.Request) {
	var req []models.NilaiKuartalInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Cakupan mustahiq: pastikan semua santri berada di kelas/tingkatannya.
	sids := make([]int, 0, len(req))
	for _, it := range req {
		sids = append(sids, it.SantriID)
	}
	if penilaianScopeGuardSantriEdit(w, r, sids) {
		return
	}

	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	if tahunAjaran == "" {
		tahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}

	// Enforcement kunci: tolak bila semester (diturunkan dari kuartal) sudah TERKUNCI.
	semesterDicek := map[int]bool{}
	for _, it := range req {
		sem := models.SemesterDariKuartal(it.Kuartal)
		if semesterDicek[sem] {
			continue
		}
		semesterDicek[sem] = true
		locked, err := models.IsSemesterLocked(r.Context(), tahunAjaran, sem)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if locked {
			http.Error(w, "nilai semester ini sudah terkunci", http.StatusForbidden)
			return
		}
	}

	if err := models.BulkInputNilaiKuartal(r.Context(), req, tahunAjaran); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Nilai Kuartal berhasil disimpan"})
}

// BulkInputKhos saves an array of Khos (Nilai Raport) scores
func BulkInputKhos(w http.ResponseWriter, r *http.Request) {
	var req []models.NilaiKhosInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sids := make([]int, 0, len(req))
	for _, it := range req {
		sids = append(sids, it.SantriID)
	}
	if penilaianScopeGuardSantriEdit(w, r, sids) {
		return
	}

	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	if tahunAjaran == "" {
		tahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}

	semesterDicek := map[int]bool{}
	for _, it := range req {
		if semesterDicek[it.Semester] {
			continue
		}
		semesterDicek[it.Semester] = true
		locked, err := models.IsSemesterLocked(r.Context(), tahunAjaran, it.Semester)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if locked {
			http.Error(w, "nilai semester ini sudah terkunci", http.StatusForbidden)
			return
		}
	}

	if err := models.BulkInputNilaiKhos(r.Context(), req, tahunAjaran); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Nilai Raport berhasil disimpan"})
}

// GenerateKhos triggers the calculation of Nilai Khos for a student's semester
func GenerateKhos(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SantriID int `json:"santri_id"`
		Semester    int    `json:"semester"`
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

	if err := models.GenerateNilaiKhos(r.Context(), req.SantriID, req.Semester, tahunAjaran); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Nilai Khos berhasil dikalkulasi"})
}

// GetPenilaianSpreadsheet returns ALL grading data for one bagian in a single response.
// Query params: bagian_id (required), tahun_ajaran (optional, defaults to active).
func GetPenilaianSpreadsheet(w http.ResponseWriter, r *http.Request) {
	bagianIDStr := r.URL.Query().Get("bagian_id")
	if bagianIDStr == "" {
		writeJSONError(w, "bagian_id wajib diisi", http.StatusBadRequest)
		return
	}

	bagianID := 0
	for _, c := range bagianIDStr {
		if c < '0' || c > '9' {
			writeJSONError(w, "bagian_id tidak valid", http.StatusBadRequest)
			return
		}
		bagianID = bagianID*10 + int(c-'0')
	}

	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	if tahunAjaran == "" {
		tahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}

	if penilaianScopeGuardBagianView(w, r, bagianID) {
		return
	}

	data, err := models.GetPenilaianSpreadsheet(r.Context(), bagianID, tahunAjaran)
	if err != nil {
		writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// BulkInputBayan handles bulk saving of Al-Bayan override
func BulkInputBayan(w http.ResponseWriter, r *http.Request) {
	var req []models.NilaiBayanInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sids := make([]int, 0, len(req))
	for _, it := range req {
		sids = append(sids, it.SantriID)
	}
	if penilaianScopeGuardSantriEdit(w, r, sids) {
		return
	}

	tahunAjaran := r.URL.Query().Get("tahun_ajaran")
	if tahunAjaran == "" {
		tahunAjaran = models.GetTahunAjaranAktif(r.Context())
	}

	if err := models.BulkInputNilaiBayan(r.Context(), req, tahunAjaran); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Override Al-Bayan berhasil disimpan"})
}
