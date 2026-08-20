package models

import (
	"context"
	"time"

	"github.com/mubtadiaat/app/config"
)

type KalenderKuartal struct {
	ID          int       `json:"id"`
	Kuartal     int       `json:"kuartal"`
	TahunAjaran string    `json:"tahun_ajaran"`
	TglMulai    string    `json:"tgl_mulai"`
	TglSelesai  string    `json:"tgl_selesai"`
	CreatedAt   time.Time `json:"created_at"`
}

func GetKalenderByTahun(ctx context.Context, tahunAjaran string) ([]KalenderKuartal, error) {
	rows, err := config.DB.Query(ctx, 
		`SELECT id, kuartal, tahun_ajaran, TO_CHAR(tgl_mulai, 'YYYY-MM-DD'), TO_CHAR(tgl_selesai, 'YYYY-MM-DD'), created_at 
		 FROM kalender_kuartal 
		 WHERE tahun_ajaran = $1 
		 ORDER BY kuartal ASC`, tahunAjaran)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := []KalenderKuartal{}
	for rows.Next() {
		var k KalenderKuartal
		if err := rows.Scan(&k.ID, &k.Kuartal, &k.TahunAjaran, &k.TglMulai, &k.TglSelesai, &k.CreatedAt); err != nil {
			return nil, err
		}
		res = append(res, k)
	}
	return res, nil
}

func GetTahunAjaran(ctx context.Context) ([]string, error) {
	rows, err := config.DB.Query(ctx, "SELECT DISTINCT tahun_ajaran FROM kalender_kuartal ORDER BY tahun_ajaran DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		res = append(res, t)
	}
	return res, nil
}

func UpsertKalender(ctx context.Context, k KalenderKuartal) error {
	_, err := config.DB.Exec(ctx,
		`INSERT INTO kalender_kuartal (kuartal, tahun_ajaran, tgl_mulai, tgl_selesai) 
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (kuartal, tahun_ajaran) 
		 DO UPDATE SET tgl_mulai = EXCLUDED.tgl_mulai, tgl_selesai = EXCLUDED.tgl_selesai`,
		k.Kuartal, k.TahunAjaran, k.TglMulai, k.TglSelesai)
	return err
}
