package models

import (
	"context"
	"errors"

	"github.com/mubtadiaat/app/config"
)

// StatusPenilaian merepresentasikan state kunci nilai untuk satu (tahun_ajaran, semester)
// beserta progres konfirmasi tiap bagian target.
type StatusPenilaian struct {
	TahunAjaran string          `json:"tahun_ajaran"`
	Semester    int             `json:"semester"`
	Status      string          `json:"status"` // DRAFT | MASA_KOREKSI | TERKUNCI
	OpenedAt    *string         `json:"opened_at,omitempty"`
	LockedAt    *string         `json:"locked_at,omitempty"`
	Bagian      []BagianKonfirm `json:"bagian"`
	TotalBagian int             `json:"total_bagian"`
	TotalDone   int             `json:"total_konfirmasi"`
}

// BagianKonfirm adalah status konfirmasi satu bagian (kelas) oleh mustahiq-nya.
type BagianKonfirm struct {
	BagianID     int     `json:"bagian_id"`
	BagianNama   string  `json:"bagian_nama"`
	KelasNama    string  `json:"kelas_nama"`
	TingkatNama  string  `json:"tingkatan_nama"`
	PengajarID   *int    `json:"pengajar_id"`
	PengajarNama *string `json:"pengajar_nama"`
	Confirmed    bool    `json:"confirmed"`
	ConfirmedAt  *string `json:"confirmed_at,omitempty"`
}

// SemesterDariKuartal mengembalikan semester (1/2) dari nomor kuartal (1..4).
func SemesterDariKuartal(kuartal int) int {
	if kuartal <= 2 {
		return 1
	}
	return 2
}

// GetPenilaianStatus mengembalikan status kunci + progres konfirmasi bagian.
// Bila belum ada baris status, dianggap DRAFT.
func GetPenilaianStatus(ctx context.Context, tahunAjaran string, semester int) (*StatusPenilaian, error) {
	res := &StatusPenilaian{TahunAjaran: tahunAjaran, Semester: semester, Status: "DRAFT"}

	var status string
	var openedAt, lockedAt *string
	err := config.DB.QueryRow(ctx,
		`SELECT status, to_char(opened_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'), to_char(locked_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		 FROM penilaian_status WHERE tahun_ajaran = $1 AND semester = $2`,
		tahunAjaran, semester).Scan(&status, &openedAt, &lockedAt)
	if err == nil {
		res.Status = status
		res.OpenedAt = openedAt
		res.LockedAt = lockedAt
	}

	// Bagian target = seluruh penugasan mustahiq (mustahiq_bagian). Tabel ini
	// UNIQUE per bagian (penugasan berjalan), jadi tidak difilter tahun_ajaran
	// agar tidak rentan terhadap ketidakcocokan nilai tahun_ajaran tersimpan.
	rows, err := config.DB.Query(ctx,
		`SELECT b.id, b.nama_bagian, COALESCE(k.nama, ''), COALESCE(t.nama, ''),
		        mb.pengajar_id, p.nama,
		        (pk.id IS NOT NULL) AS confirmed,
		        to_char(pk.confirmed_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		 FROM mustahiq_bagian mb
		 JOIN bagian b ON b.id = mb.bagian_id
		 LEFT JOIN kelas k ON b.kelas_id = k.id
		 LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		 LEFT JOIN pengajar p ON mb.pengajar_id = p.id
		 LEFT JOIN penilaian_konfirmasi pk
		   ON pk.bagian_id = b.id AND pk.tahun_ajaran = $1 AND pk.semester = $2
		 ORDER BY t.urutan NULLS LAST, b.id`, tahunAjaran, semester)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var bk BagianKonfirm
		if err := rows.Scan(&bk.BagianID, &bk.BagianNama, &bk.KelasNama, &bk.TingkatNama,
			&bk.PengajarID, &bk.PengajarNama, &bk.Confirmed, &bk.ConfirmedAt); err != nil {
			return nil, err
		}
		res.Bagian = append(res.Bagian, bk)
		res.TotalBagian++
		if bk.Confirmed {
			res.TotalDone++
		}
	}
	return res, nil
}

// IsSemesterLocked mengembalikan true bila (tahun_ajaran, semester) berstatus TERKUNCI.
func IsSemesterLocked(ctx context.Context, tahunAjaran string, semester int) (bool, error) {
	var status string
	err := config.DB.QueryRow(ctx,
		`SELECT status FROM penilaian_status WHERE tahun_ajaran = $1 AND semester = $2`,
		tahunAjaran, semester).Scan(&status)
	if err != nil {
		// Tidak ada baris = DRAFT = tidak terkunci.
		return false, nil
	}
	return status == "TERKUNCI", nil
}

// OpenKoreksi memindahkan status ke MASA_KOREKSI (admin/pimpinan).
// Boleh dipanggil dari DRAFT maupun TERKUNCI (buka kunci = kembali ke koreksi).
func OpenKoreksi(ctx context.Context, tahunAjaran string, semester, userID int) error {
	_, err := config.DB.Exec(ctx,
		`INSERT INTO penilaian_status (tahun_ajaran, semester, status, opened_by, opened_at)
		 VALUES ($1, $2, 'MASA_KOREKSI', $3, now())
		 ON CONFLICT (tahun_ajaran, semester)
		 DO UPDATE SET status = 'MASA_KOREKSI', opened_by = EXCLUDED.opened_by,
		               opened_at = now(), locked_by = NULL, locked_at = NULL,
		               updated_at = now()`,
		tahunAjaran, semester, userID)
	return err
}

// ConfirmBagian mencatat konfirmasi "sudah dikoreksi" untuk satu bagian.
// Bila setelah konfirmasi ini SEMUA bagian target sudah terkonfirmasi, semester
// otomatis dikunci + nilai final digenerate.
func ConfirmBagian(ctx context.Context, tahunAjaran string, semester, bagianID, pengajarID, userID int) error {
	// Hanya boleh saat MASA_KOREKSI.
	st, err := GetPenilaianStatus(ctx, tahunAjaran, semester)
	if err != nil {
		return err
	}
	if st.Status != "MASA_KOREKSI" {
		return errors.New("konfirmasi hanya bisa saat masa koreksi dibuka")
	}

	_, err = config.DB.Exec(ctx,
		`INSERT INTO penilaian_konfirmasi (tahun_ajaran, semester, bagian_id, pengajar_id, user_id)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (tahun_ajaran, semester, bagian_id)
		 DO UPDATE SET pengajar_id = EXCLUDED.pengajar_id, user_id = EXCLUDED.user_id,
		               confirmed_at = now()`,
		tahunAjaran, semester, bagianID, pengajarID, userID)
	if err != nil {
		return err
	}

	// Cek ulang apakah semua bagian target terkonfirmasi.
	st2, err := GetPenilaianStatus(ctx, tahunAjaran, semester)
	if err != nil {
		return err
	}
	if st2.TotalBagian > 0 && st2.TotalDone >= st2.TotalBagian {
		return lockAndGenerate(ctx, tahunAjaran, semester, userID)
	}
	return nil
}

// ForceLock mengunci paksa semester (admin/pimpinan) tanpa menunggu konfirmasi.
func ForceLock(ctx context.Context, tahunAjaran string, semester, userID int) error {
	return lockAndGenerate(ctx, tahunAjaran, semester, userID)
}

// Unlock membuka kunci (override admin/pimpinan): kembali ke MASA_KOREKSI.
func Unlock(ctx context.Context, tahunAjaran string, semester, userID int) error {
	_, err := config.DB.Exec(ctx,
		`INSERT INTO penilaian_status (tahun_ajaran, semester, status, opened_by, opened_at)
		 VALUES ($1, $2, 'MASA_KOREKSI', $3, now())
		 ON CONFLICT (tahun_ajaran, semester)
		 DO UPDATE SET status = 'MASA_KOREKSI', locked_by = NULL, locked_at = NULL,
		               updated_at = now()`,
		tahunAjaran, semester, userID)
	return err
}

// lockAndGenerate menandai TERKUNCI lalu men-generate nilai final:
//   - Khos untuk semua santri aktif pada semester ini.
//   - Bila semester 2, Al-Bayan tahunan untuk semua santri aktif.
func lockAndGenerate(ctx context.Context, tahunAjaran string, semester, userID int) error {
	// Set status TERKUNCI.
	_, err := config.DB.Exec(ctx,
		`INSERT INTO penilaian_status (tahun_ajaran, semester, status, locked_by, locked_at)
		 VALUES ($1, $2, 'TERKUNCI', $3, now())
		 ON CONFLICT (tahun_ajaran, semester)
		 DO UPDATE SET status = 'TERKUNCI', locked_by = EXCLUDED.locked_by,
		               locked_at = now(), updated_at = now()`,
		tahunAjaran, semester, userID)
	if err != nil {
		return err
	}

	// Daftar santri aktif.
	rows, err := config.DB.Query(ctx, `SELECT id FROM santri WHERE status = 'aktif'`)
	if err != nil {
		return err
	}
	var santriIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		santriIDs = append(santriIDs, id)
	}
	rows.Close()

	for _, sid := range santriIDs {
		if err := GenerateNilaiKhos(ctx, sid, semester, tahunAjaran); err != nil {
			return err
		}
	}

	if semester == 2 {
		for _, sid := range santriIDs {
			if err := GenerateAlBayan(ctx, sid, tahunAjaran); err != nil {
				return err
			}
		}
	}

	return nil
}
