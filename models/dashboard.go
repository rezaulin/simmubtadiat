package models

import (
	"context"

	"github.com/mubtadiaat/app/config"
)

type DashboardStats struct {
	TotalSantri int `json:"total_santri"`
	TotalBagian int `json:"total_bagian"`
	TotalAlumni int `json:"total_alumni"`
	InputNilai  int `json:"input_nilai"` // Persentase kasar atau count
}

func GetDashboardStats(ctx context.Context, roles []string, pengajarID *int) (DashboardStats, error) {
	var stats DashboardStats

	isGlobal := false
	for _, role := range roles {
		if role == "pimpinan" || role == "admin" {
			isGlobal = true
			break
		}
	}

	if isGlobal {
		// 1. Total Santri Aktif
		err := config.DB.QueryRow(ctx, "SELECT COUNT(id) FROM santri WHERE status = 'aktif'").Scan(&stats.TotalSantri)
		if err != nil {
			return stats, err
		}

		// 2. Total Bagian Aktif
		err = config.DB.QueryRow(ctx, "SELECT COUNT(id) FROM bagian").Scan(&stats.TotalBagian)
		if err != nil {
			return stats, err
		}

		// 3. Total Alumni
		err = config.DB.QueryRow(ctx, "SELECT COUNT(id) FROM alumni").Scan(&stats.TotalAlumni)
		if err != nil {
			return stats, err
		}

		// 4. Dummy input nilai percentage
		stats.InputNilai = 85
	} else if pengajarID != nil {
		// 1. Total Santri in their classes
		err := config.DB.QueryRow(ctx, `
			SELECT COUNT(DISTINCT s.id) 
			FROM santri s
			WHERE s.status = 'aktif' AND s.bagian_id IN (
				SELECT bagian_id FROM pengajar_bagian WHERE pengajar_id = $1
				UNION
				SELECT bagian_id FROM jadwal_pelajaran WHERE pengajar_id = $1
				UNION
				SELECT bagian_id FROM mustahiq_bagian WHERE pengajar_id = $1
			)
		`, *pengajarID).Scan(&stats.TotalSantri)
		if err != nil {
			return stats, err
		}

		// 2. Total Bagian they teach
		err = config.DB.QueryRow(ctx, `
			SELECT COUNT(DISTINCT bagian_id) FROM (
				SELECT bagian_id FROM pengajar_bagian WHERE pengajar_id = $1
				UNION
				SELECT bagian_id FROM jadwal_pelajaran WHERE pengajar_id = $1
				UNION
				SELECT bagian_id FROM mustahiq_bagian WHERE pengajar_id = $1
			) t
		`, *pengajarID).Scan(&stats.TotalBagian)
		if err != nil {
			return stats, err
		}

		// 3. Dummy Alumni (maybe total santri in school instead? Or just 0)
		stats.TotalAlumni = 0

		// 4. Dummy input nilai
		stats.InputNilai = 100
	}

	return stats, nil
}
