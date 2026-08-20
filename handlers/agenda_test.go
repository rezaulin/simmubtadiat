package handlers

import "testing"

// Fitur agenda-bebas: validasi input agenda (tanpa DB).

func TestIsValidISODate(t *testing.T) {
	valid := []string{"2024-01-01", "2024-02-29", "2025-12-31"}
	for _, s := range valid {
		if !isValidISODate(s) {
			t.Errorf("expected %q valid", s)
		}
	}
	invalid := []string{"", "2024-2-3", "2024/02/03", "20240203", "2024-13-01", "2024-00-10", "2024-02-30", "2023-02-29", "2024-04-31", "abcd-ef-gh"}
	for _, s := range invalid {
		if isValidISODate(s) {
			t.Errorf("expected %q invalid", s)
		}
	}
}

func strptr(s string) *string { return &s }

func TestValidateAgendaInput(t *testing.T) {
	cases := []struct {
		name    string
		in      agendaInput
		wantErr bool
	}{
		{"judul kosong", agendaInput{Judul: "  ", TglMulai: "2025-01-10"}, true},
		{"tgl_mulai invalid", agendaInput{Judul: "Rapat", TglMulai: "2025-13-01"}, true},
		{"tgl_selesai invalid", agendaInput{Judul: "Rapat", TglMulai: "2025-01-10", TglSelesai: strptr("2025-02-30")}, true},
		{"selesai sebelum mulai", agendaInput{Judul: "Rapat", TglMulai: "2025-01-10", TglSelesai: strptr("2025-01-09")}, true},
		{"valid single day", agendaInput{Judul: "Rapat", TglMulai: "2025-01-10"}, false},
		{"valid range", agendaInput{Judul: "Haul", TglMulai: "2025-01-10", TglSelesai: strptr("2025-01-12")}, false},
		{"valid selesai kosong string", agendaInput{Judul: "Rapat", TglMulai: "2025-01-10", TglSelesai: strptr("  ")}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			agenda, errMsg := validateAgendaInput(c.in)
			if c.wantErr && errMsg == "" {
				t.Fatalf("expected error, got none (agenda=%+v)", agenda)
			}
			if !c.wantErr {
				if errMsg != "" {
					t.Fatalf("unexpected error: %s", errMsg)
				}
				if agenda.Judul == "" || agenda.TglMulai == "" {
					t.Fatalf("expected normalized agenda, got %+v", agenda)
				}
			}
		})
	}
}

// tgl_selesai berupa string kosong/whitespace harus dinormalkan ke nil (acara satu hari).
func TestValidateAgendaInput_EmptySelesaiBecomesNil(t *testing.T) {
	agenda, errMsg := validateAgendaInput(agendaInput{Judul: "Rapat", TglMulai: "2025-01-10", TglSelesai: strptr("")})
	if errMsg != "" {
		t.Fatalf("unexpected error: %s", errMsg)
	}
	if agenda.TglSelesai != nil {
		t.Errorf("expected TglSelesai nil for empty string, got %v", *agenda.TglSelesai)
	}
}
