package models

import (
	"context"
	"fmt"

	"github.com/mubtadiaat/app/config"
)

// RekapUstadz adalah agregat kehadiran seorang ustadz pada tahun ajaran / bulan tertentu.
type RekapUstadz struct {
	PengajarID  int    `json:"pengajar_id"`
	Nama        string `json:"nama_pengajar"`
	TotalSakit  int    `json:"total_sakit"`
	TotalIzin   int    `json:"total_izin"`
	TotalAlpha  int    `json:"total_alpha"`
	TotalHadir  int    `json:"total_hadir"`
}

// GetRekapAbsensiPengajarManual menghitung total absensi pengajar dari input manual bulanan.
func GetRekapAbsensiPengajarManual(ctx context.Context, tahunAjaran string, tahunHijri int, bulanHijri int, roles []string, pengajarID *int) ([]RekapUstadz, error) {
	// Query to get pengajar and their manual attendance sums.
	joinClauses := ""
	args := []interface{}{}

	isGlobal := false
	for _, role := range roles {
		if role == "pimpinan" || role == "admin" || role == "keamanan" || role == "mufatish" {
			isGlobal = true
			break
		}
	}

	if !isGlobal && pengajarID != nil {
		args = append(args, *pengajarID)
		joinClauses += fmt.Sprintf(` AND p.id IN (
			SELECT mb2.pengajar_id 
			FROM mustahiq_bagian mb2
			JOIN bagian b2 ON mb2.bagian_id = b2.id
			WHERE b2.tingkatan_id IN (
				SELECT b.tingkatan_id
				FROM mustahiq_bagian mb
				JOIN bagian b ON mb.bagian_id = b.id
				WHERE mb.pengajar_id = $%d
			)
		)`, len(args))
	}

	if tahunAjaran != "" {
		args = append(args, tahunAjaran)
		joinClauses += fmt.Sprintf(" AND am.tahun_ajaran = $%d", len(args))
	}
	if tahunHijri > 0 {
		args = append(args, tahunHijri)
		joinClauses += fmt.Sprintf(" AND am.tahun_hijri = $%d", len(args))
	}
	if bulanHijri > 0 {
		args = append(args, bulanHijri)
		joinClauses += fmt.Sprintf(" AND am.bulan_hijri = $%d", len(args))
	}

	query := `
		SELECT p.id, p.nama,
			COALESCE(SUM(am.total_sakit), 0),
			COALESCE(SUM(am.total_izin), 0),
			COALESCE(SUM(am.total_alpha), 0),
			COALESCE(SUM(am.total_hadir), 0)
		FROM pengajar p
		JOIN absensi_manual_pengajar_bulanan am ON am.pengajar_id = p.id ` + joinClauses + `
		WHERE p.is_active = true
		GROUP BY p.id, p.nama
		ORDER BY p.nama ASC
	`

	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []RekapUstadz
	for rows.Next() {
		var u RekapUstadz
		if err := rows.Scan(&u.PengajarID, &u.Nama, &u.TotalSakit, &u.TotalIzin, &u.TotalAlpha, &u.TotalHadir); err != nil {
			return nil, err
		}
		res = append(res, u)
	}
	return res, nil
}

// GetRekapAbsensiSiswaManual mengembalikan rekap absensi satu bagian menggunakan sumber manual.
func GetRekapAbsensiSiswaManual(ctx context.Context, bagianID int, tahunAjaran string, tahunHijri int, bulanHijri int) (map[string]interface{}, error) {
	joinClauses := ""
	args := []interface{}{bagianID}

	if tahunAjaran != "" {
		args = append(args, tahunAjaran)
		joinClauses += fmt.Sprintf(" AND am.tahun_ajaran = $%d", len(args))
	}
	if tahunHijri > 0 {
		args = append(args, tahunHijri)
		joinClauses += fmt.Sprintf(" AND am.tahun_hijri = $%d", len(args))
	}
	if bulanHijri > 0 {
		args = append(args, bulanHijri)
		joinClauses += fmt.Sprintf(" AND am.bulan_hijri = $%d", len(args))
	}

	query := `
		SELECT s.id, s.nama, COALESCE(s.stambuk, ''),
			COALESCE(SUM(am.total_sakit), 0),
			COALESCE(SUM(am.total_izin), 0),
			COALESCE(SUM(am.total_alpha), 0),
			COALESCE(SUM(am.total_hadir), 0)
		FROM santri s
		LEFT JOIN absensi_manual_bulanan am ON am.santri_id = s.id ` + joinClauses + `
		WHERE s.bagian_id = $1
		GROUP BY s.id, s.nama, s.stambuk
		ORDER BY s.nama ASC
	`

	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var santriList []map[string]interface{}
	totalSantri := 0
	sumIzin, sumSakit, sumAlpha, sumHadir := 0, 0, 0, 0
	santriTanpaAlpha := 0

	for rows.Next() {
		var id int
		var nama, stambuk string
		var sakit, izin, alpha, hadir int
		if err := rows.Scan(&id, &nama, &stambuk, &sakit, &izin, &alpha, &hadir); err != nil {
			return nil, err
		}
		totalSantri++

		sumIzin += izin
		sumSakit += sakit
		sumAlpha += alpha
		sumHadir += hadir
		if alpha == 0 {
			santriTanpaAlpha++
		}

		santriList = append(santriList, map[string]interface{}{
			"santri_id":     id,
			"nama_santri":   nama,
			"stambuk":       stambuk,
			"izin":          izin,
			"sakit":         sakit,
			"alpha":         alpha,
			"hadir":         hadir,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"ringkasan": map[string]interface{}{
			"total_santri":       totalSantri,
			"total_sakit":        sumSakit,
			"total_izin":         sumIzin,
			"total_alpha":        sumAlpha,
			"total_hadir":        sumHadir,
			"santri_tanpa_alpha": santriTanpaAlpha,
		},
		"santri": santriList,
	}, nil
}
