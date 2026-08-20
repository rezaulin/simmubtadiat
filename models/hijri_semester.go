package models

import (
	"context"

	"github.com/mubtadiaat/app/config"
)

// HijriSemesterMap memetakan satu bulan Hijriyah absolut ke semester (1/2).
type HijriSemesterMap struct {
	TahunHijri  int    `json:"tahun_hijri"`
	BulanHijri  int    `json:"bulan_hijri"` // 1-12
	Semester    int    `json:"semester"`    // 1 atau 2
	TahunAjaran string `json:"tahun_ajaran,omitempty"`
}

// GetHijriSemesterMap mengambil seluruh mapping, opsional difilter per tahun Hijri.
func GetHijriSemesterMap(ctx context.Context, tahunHijri int) ([]HijriSemesterMap, error) {
	query := `SELECT tahun_hijri, bulan_hijri, semester, COALESCE(tahun_ajaran, '')
	          FROM hijri_semester_map`
	args := []interface{}{}
	if tahunHijri > 0 {
		query += ` WHERE tahun_hijri = $1`
		args = append(args, tahunHijri)
	}
	query += ` ORDER BY tahun_hijri, bulan_hijri`

	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := []HijriSemesterMap{}
	for rows.Next() {
		var m HijriSemesterMap
		if err := rows.Scan(&m.TahunHijri, &m.BulanHijri, &m.Semester, &m.TahunAjaran); err != nil {
			return nil, err
		}
		res = append(res, m)
	}
	return res, nil
}

// SaveHijriSemesterMap upsert batch mapping bulan Hijri -> semester.
func SaveHijriSemesterMap(ctx context.Context, entries []HijriSemesterMap) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, e := range entries {
		if _, err := tx.Exec(ctx, `
			INSERT INTO hijri_semester_map (tahun_hijri, bulan_hijri, semester, tahun_ajaran, updated_at)
			VALUES ($1, $2, $3, NULLIF($4, ''), CURRENT_TIMESTAMP)
			ON CONFLICT (tahun_hijri, bulan_hijri)
			DO UPDATE SET semester = EXCLUDED.semester,
			              tahun_ajaran = EXCLUDED.tahun_ajaran,
			              updated_at = CURRENT_TIMESTAMP`,
			e.TahunHijri, e.BulanHijri, e.Semester, e.TahunAjaran); err != nil {
			return err
		}
	}

	// Backfill baris absensi manual lama yang sesuai mapping baru.
	if _, err := tx.Exec(ctx, `
		UPDATE absensi_manual_bulanan am
		   SET semester = m.semester
		  FROM hijri_semester_map m
		 WHERE am.tahun_hijri = m.tahun_hijri
		   AND am.bulan_hijri = m.bulan_hijri
		   AND am.semester IS DISTINCT FROM m.semester`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE absensi_manual_pengajar_bulanan am
		   SET semester = m.semester
		  FROM hijri_semester_map m
		 WHERE am.tahun_hijri = m.tahun_hijri
		   AND am.bulan_hijri = m.bulan_hijri
		   AND am.semester IS DISTINCT FROM m.semester`); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// SemesterBulanHijri resolve semester untuk satu bulan Hijri absolut.
// Mengembalikan 0 jika belum ada mapping.
func SemesterBulanHijri(ctx context.Context, tahunHijri, bulanHijri int) int {
	var s int
	_ = config.DB.QueryRow(ctx,
		`SELECT semester FROM hijri_semester_map WHERE tahun_hijri = $1 AND bulan_hijri = $2`,
		tahunHijri, bulanHijri).Scan(&s)
	return s
}
