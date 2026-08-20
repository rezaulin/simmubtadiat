package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	appMiddleware "github.com/mubtadiaat/app/middleware"
)

// jadwalResponse mirrors the JSON body returned by GetJadwalSayaHariIni.
type jadwalResponse struct {
	Hari   string          `json:"hari"`
	Jadwal []JadwalHariIni `json:"jadwal"`
}

// fakeJadwalRow models a stored schedule row together with the pengajar that
// owns it. The owning pengajar_id is NOT part of the public JadwalHariIni
// payload; it exists only so the fake data source can reproduce the database's
// `WHERE j.pengajar_id = $1 AND j.hari = $2` scoping that enforces RBAC.
type fakeJadwalRow struct {
	pengajarID int
	hari       string
	jadwal     JadwalHariIni
}

// newFakeFetcher returns a fetcher that behaves like the real SQL query: it
// returns only the rows whose pengajar_id and hari match the arguments,
// preserving insertion order (the query is ORDER BY jam_mulai). It also records
// which pengajarID it was called with so tests can assert the handler passes
// the session identity rather than any client-supplied value.
func newFakeFetcher(rows []fakeJadwalRow, calledWith *int) func(context.Context, int, string) ([]JadwalHariIni, error) {
	return func(_ context.Context, pengajarID int, hari string) ([]JadwalHariIni, error) {
		if calledWith != nil {
			*calledWith = pengajarID
		}
		out := []JadwalHariIni{}
		for _, r := range rows {
			if r.pengajarID == pengajarID && r.hari == hari {
				out = append(out, r.jadwal)
			}
		}
		return out, nil
	}
}

// callJadwalHariIni invokes the handler with the given session and optional raw
// query string, returning the decoded response and HTTP status code.
func callJadwalHariIni(t *testing.T, user appMiddleware.UserSession, rawQuery string) (jadwalResponse, int) {
	t.Helper()

	target := "/api/akademik/jadwal-saya-hari-ini"
	if rawQuery != "" {
		target += "?" + rawQuery
	}
	req := httptest.NewRequest(http.MethodGet, target, nil)
	ctx := context.WithValue(req.Context(), appMiddleware.UserContextKey, user)
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	GetJadwalSayaHariIni(rr, req)

	var body jadwalResponse
	if rr.Body.Len() > 0 {
		if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
			t.Fatalf("failed to decode response body: %v (raw: %s)", err, rr.Body.String())
		}
	}
	return body, rr.Code
}

// seedTwoTeachers builds a dataset where teacher 1 and teacher 2 each own two
// classes today, so exclusion can be verified. All rows use today's day name so
// they survive the `hari` filter regardless of when the test runs.
func seedTwoTeachers() []fakeJadwalRow {
	today := hariIndonesia[time.Now().Weekday()]
	return []fakeJadwalRow{
		{pengajarID: 1, hari: today, jadwal: JadwalHariIni{ID: 11, BagianID: 101, NamaBagian: "1A", MapelID: 201, NamaMapel: "Nahwu", Hari: today, JamMulai: "07:00", JamSelesai: "08:00"}},
		{pengajarID: 2, hari: today, jadwal: JadwalHariIni{ID: 22, BagianID: 202, NamaBagian: "2B", MapelID: 202, NamaMapel: "Shorof", Hari: today, JamMulai: "07:30", JamSelesai: "08:30"}},
		{pengajarID: 1, hari: today, jadwal: JadwalHariIni{ID: 13, BagianID: 103, NamaBagian: "1C", MapelID: 203, NamaMapel: "Fiqih", Hari: today, JamMulai: "09:00", JamSelesai: "10:00"}},
		{pengajarID: 2, hari: today, jadwal: JadwalHariIni{ID: 24, BagianID: 204, NamaBagian: "2D", MapelID: 204, NamaMapel: "Tauhid", Hari: today, JamMulai: "10:00", JamSelesai: "11:00"}},
	}
}

func intPtr(i int) *int { return &i }

// Requirement 4.3: the widget shows only classes scheduled for the logged-in
// teacher and never another teacher's classes.
func TestGetJadwalSayaHariIni_ReturnsOnlyOwnSchedule(t *testing.T) {
	original := fetchJadwalHariIni
	defer func() { fetchJadwalHariIni = original }()

	var calledWith int
	fetchJadwalHariIni = newFakeFetcher(seedTwoTeachers(), &calledWith)

	// Teacher 1 logs in.
	user := appMiddleware.UserSession{ID: 1, Role: "mustahiq", PengajarID: intPtr(1)}
	body, code := callJadwalHariIni(t, user, "")

	if code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", code)
	}
	if calledWith != 1 {
		t.Fatalf("expected data layer to be scoped to session pengajar_id 1, got %d", calledWith)
	}
	if len(body.Jadwal) != 2 {
		t.Fatalf("expected exactly 2 schedule entries for teacher 1, got %d: %+v", len(body.Jadwal), body.Jadwal)
	}
	for _, j := range body.Jadwal {
		// Teacher 2's rows use bagian IDs 202/204 and ids 22/24.
		if j.ID == 22 || j.ID == 24 || j.BagianID == 202 || j.BagianID == 204 {
			t.Errorf("response leaked another teacher's schedule: %+v", j)
		}
	}
}

// A different teacher logging in must see their own (different) schedule.
func TestGetJadwalSayaHariIni_ScopedPerTeacher(t *testing.T) {
	original := fetchJadwalHariIni
	defer func() { fetchJadwalHariIni = original }()

	fetchJadwalHariIni = newFakeFetcher(seedTwoTeachers(), nil)

	user := appMiddleware.UserSession{ID: 2, Role: "muroqib", PengajarID: intPtr(2)}
	body, code := callJadwalHariIni(t, user, "")

	if code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", code)
	}
	if len(body.Jadwal) != 2 {
		t.Fatalf("expected exactly 2 schedule entries for teacher 2, got %d", len(body.Jadwal))
	}
	for _, j := range body.Jadwal {
		if j.ID == 11 || j.ID == 13 || j.BagianID == 101 || j.BagianID == 103 {
			t.Errorf("response leaked teacher 1's schedule: %+v", j)
		}
	}
}

// RBAC must rely on the session identity, ignoring any attempt by the client to
// request another teacher's schedule via query parameters.
func TestGetJadwalSayaHariIni_IgnoresClientSuppliedPengajarID(t *testing.T) {
	original := fetchJadwalHariIni
	defer func() { fetchJadwalHariIni = original }()

	var calledWith int
	fetchJadwalHariIni = newFakeFetcher(seedTwoTeachers(), &calledWith)

	// Teacher 1 is logged in but tries to spoof pengajar_id=2 in the query.
	user := appMiddleware.UserSession{ID: 1, Role: "mustahiq", PengajarID: intPtr(1)}
	body, code := callJadwalHariIni(t, user, "pengajar_id=2")

	if code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", code)
	}
	if calledWith != 1 {
		t.Fatalf("expected scoping to session pengajar_id 1 despite spoofed query, got %d", calledWith)
	}
	for _, j := range body.Jadwal {
		if j.ID == 22 || j.ID == 24 || j.BagianID == 202 || j.BagianID == 204 {
			t.Errorf("spoofed query leaked teacher 2's schedule: %+v", j)
		}
	}
}

// A logged-in user without a pengajar identity (e.g. admin/wali) gets an empty
// schedule and the data layer is never queried.
func TestGetJadwalSayaHariIni_NonTeacherGetsEmpty(t *testing.T) {
	original := fetchJadwalHariIni
	defer func() { fetchJadwalHariIni = original }()

	called := false
	fetchJadwalHariIni = func(_ context.Context, _ int, _ string) ([]JadwalHariIni, error) {
		called = true
		return nil, nil
	}

	user := appMiddleware.UserSession{ID: 9, Role: "admin", PengajarID: nil}
	body, code := callJadwalHariIni(t, user, "")

	if code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", code)
	}
	if called {
		t.Error("data layer should not be queried for a user without a pengajar identity")
	}
	if len(body.Jadwal) != 0 {
		t.Errorf("expected empty schedule for non-teacher, got %+v", body.Jadwal)
	}
}
