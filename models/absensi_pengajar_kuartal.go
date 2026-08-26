package models

import (
	"context"
	"strconv"
	"time"

	"github.com/mubtadiaat/app/config"
)

type AbsensiPengajarKuartal struct {
	ID           int       `json:"id"`
	PengajarID   int       `json:"pengajar_id"`
	PengajarNama string    `json:"pengajar_nama"`
	TahunAjaran  string    `json:"tahun_ajaran"`
	Kuartal1     int       `json:"kuartal_1"`
	Kuartal23    int       `json:"kuartal_23"`
	Kuartal4     int       `json:"kuartal_4"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// SaveAbsensiPengajarKuartal saves/updates quarterly attendance for teachers (upsert per pengajar+tahun).
func SaveAbsensiPengajarKuartal(ctx context.Context, tahunAjaran string, data []AbsensiPengajarKuartal) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO absensi_pengajar_kuartal
			(pengajar_id, tahun_ajaran, kuartal_1, kuartal_23, kuartal_4, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (pengajar_id, tahun_ajaran)
		DO UPDATE SET
			kuartal_1 = EXCLUDED.kuartal_1,
			kuartal_23 = EXCLUDED.kuartal_23,
			kuartal_4 = EXCLUDED.kuartal_4,
			updated_at = CURRENT_TIMESTAMP
	`
	for _, d := range data {
		if _, err := tx.Exec(ctx, query, d.PengajarID, tahunAjaran, d.Kuartal1, d.Kuartal23, d.Kuartal4); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GetAbsensiPengajarKuartal returns ALL teachers (mustahiq + munawwib) for the given
// filter, LEFT JOINed with their quarterly attendance so teachers without any record
// still appear with zero values. Used by both Input and Rekap pages.
//
// tingkatanID/kelasID == 0 means "no filter" (show all assigned teachers for the tahun).
func GetAbsensiPengajarKuartal(ctx context.Context, tingkatanID int, kelasID int, tahunAjaran string) ([]AbsensiPengajarKuartal, error) {
	// Base: distinct set of teachers assigned as mustahiq (mustahiq_bagian) OR
	// munawwib (pengajar_bagian, peran='munawwib') within scope.
	query := `
		SELECT DISTINCT p.id, p.nama,
			COALESCE(apk.kuartal_1, 0)  AS kuartal_1,
			COALESCE(apk.kuartal_23, 0) AS kuartal_23,
			COALESCE(apk.kuartal_4, 0)  AS kuartal_4,
			COALESCE(apk.id, 0)         AS rec_id
		FROM pengajar p
		JOIN (
			SELECT mb.pengajar_id, b.tingkatan_id, b.kelas_id
			FROM mustahiq_bagian mb
			JOIN bagian b ON b.id = mb.bagian_id
			UNION
			SELECT pb.pengajar_id, b.tingkatan_id, b.kelas_id
			FROM pengajar_bagian pb
			JOIN bagian b ON b.id = pb.bagian_id
			WHERE pb.peran = 'munawwib'
		) asg ON asg.pengajar_id = p.id
		LEFT JOIN absensi_pengajar_kuartal apk
			ON apk.pengajar_id = p.id AND apk.tahun_ajaran = $1
		WHERE p.is_active = true
	`
	args := []interface{}{tahunAjaran}

	if tingkatanID > 0 {
		args = append(args, tingkatanID)
		query += ` AND asg.tingkatan_id = $2`
	}
	if kelasID > 0 {
		args = append(args, kelasID)
		query += ` AND asg.kelas_id = $` + strconv.Itoa(len(args))
	}

	query += ` ORDER BY p.nama ASC`

	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []AbsensiPengajarKuartal{}
	for rows.Next() {
		var a AbsensiPengajarKuartal
		a.TahunAjaran = tahunAjaran
		if err := rows.Scan(&a.PengajarID, &a.PengajarNama, &a.Kuartal1, &a.Kuartal23, &a.Kuartal4, &a.ID); err != nil {
			return nil, err
		}
		result = append(result, a)
	}
	return result, nil
}
