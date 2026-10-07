package models

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/mubtadiaat/app/config"
)

// ErrKalenderBentrok = penolakan karena rentang tanggal tahun ajaran yang
// disimpan menimpa kalender tahun ajaran LAIN. Insiden 2026-10-07: form
// kalender dimuat untuk TA-X lalu kolom Tahun Ajaran diganti ke TA-Y sebelum
// Simpan → tanggal TA-X tertulis ke TA-Y dan kalender TA-X hilang tertimpa.
var ErrKalenderBentrok = errors.New("kalender bentrok")

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
	// Guard: rentang kuartal ini tidak boleh berbagi satu hari pun dengan
	// kalender tahun ajaran LAIN — itu tandanya data tertulis ke TA yang
	// salah (form kalender diganti TA-nya setelah Muat).
	var bentrok string
	err := config.DB.QueryRow(ctx,
		`SELECT tahun_ajaran FROM kalender_kuartal
		  WHERE tahun_ajaran <> $1
		    AND tgl_mulai <= $3::date AND tgl_selesai >= $2::date
		  LIMIT 1`, k.TahunAjaran, k.TglMulai, k.TglSelesai).Scan(&bentrok)
	if err == nil {
		return fmt.Errorf("%w: tanggal %s–%s menimpa kalender TA %s",
			ErrKalenderBentrok, k.TglMulai, k.TglSelesai, bentrok)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	_, err = config.DB.Exec(ctx,
		`INSERT INTO kalender_kuartal (kuartal, tahun_ajaran, tgl_mulai, tgl_selesai) 
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (kuartal, tahun_ajaran) 
		 DO UPDATE SET tgl_mulai = EXCLUDED.tgl_mulai, tgl_selesai = EXCLUDED.tgl_selesai`,
		k.Kuartal, k.TahunAjaran, k.TglMulai, k.TglSelesai)
	return err
}
