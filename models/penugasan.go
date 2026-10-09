package models

import (
	"context"
	"strconv"

	"github.com/mubtadiaat/app/config"
)

func AssignPengajarToBagian(ctx context.Context, pengajarID, bagianID int, tahunAjaran, peran string) error {
	_, err := config.DB.Exec(ctx,
		`INSERT INTO pengajar_bagian (pengajar_id, bagian_id, tahun_ajaran, peran) 
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (pengajar_id, bagian_id, tahun_ajaran, peran) DO NOTHING`,
		pengajarID, bagianID, tahunAjaran, peran)
	return err
}

func GetPengajarBagian(ctx context.Context, tahunAjaran string, bagianID string, pengajarID string) ([]map[string]interface{}, error) {
	query := `SELECT pb.id, p.nama, b.nama_bagian, pb.peran, pb.tahun_ajaran, pb.bagian_id, pb.pengajar_id
		 FROM pengajar_bagian pb
		 JOIN pengajar p ON pb.pengajar_id = p.id
		 JOIN bagian b ON pb.bagian_id = b.id
		 WHERE 1=1`
	args := []interface{}{}
	i := 1

	if tahunAjaran != "" {
		query += ` AND pb.tahun_ajaran = $` + strconv.Itoa(i)
		args = append(args, tahunAjaran)
		i++
	}
	if bagianID != "" {
		query += ` AND pb.bagian_id = $` + strconv.Itoa(i)
		args = append(args, bagianID)
		i++
	}
	if pengajarID != "" {
		query += ` AND pb.pengajar_id = $` + strconv.Itoa(i)
		args = append(args, pengajarID)
		i++
	}

	query += ` ORDER BY pb.tahun_ajaran DESC, b.nama_bagian ASC`

	rows, err := config.DB.Query(ctx, query, args...)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var id, bagianID, pengajarID int
		var nama, bagian, peran, tahunAjaran string
		if err := rows.Scan(&id, &nama, &bagian, &peran, &tahunAjaran, &bagianID, &pengajarID); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"id":            id,
			"nama_pengajar": nama,
			"nama_bagian":   bagian,
			"peran":         peran,
			"tahun_ajaran":  tahunAjaran,
			"bagian_id":     bagianID,
			"pengajar_id":   pengajarID,
		})
	}
	return result, nil
}

// Riwayat penugasan SATU pengajar, digabung dari ketiga sumber penugasan:
// mufatish_kelas (mufatish), mustahiq_bagian (mustahiq) dan pengajar_bagian
// (munawwib / peran lain). Dipakai modal "Info Detail Pengajar" supaya semua
// jenis penugasan ikut terbaca — sebelumnya hanya pengajar_bagian yang dibaca,
// sehingga pengajar mufatish/mustahiq tampil "Belum ada riwayat penugasan".
func GetRiwayatPenugasan(ctx context.Context, pengajarID string) ([]map[string]interface{}, error) {
	query := `
		SELECT jenis, penugasan, tahun_ajaran FROM (
			SELECT 1 AS urut, 'Mufatish' AS jenis,
			       t.nama || ' / Kelas ' || k.nama AS penugasan,
			       mk.tahun_ajaran
			FROM mufatish_kelas mk
			JOIN kelas k ON mk.kelas_id = k.id
			JOIN tingkatan t ON mk.tingkatan_id = t.id
			WHERE mk.pengajar_id = $1
			UNION ALL
			SELECT 2, 'Mustahiq',
			       t.nama || ' / Kelas ' || k.nama || ' / Bagian ' || b.nama_bagian,
			       mb.tahun_ajaran
			FROM mustahiq_bagian mb
			JOIN bagian b ON mb.bagian_id = b.id
			JOIN kelas k ON b.kelas_id = k.id
			JOIN tingkatan t ON b.tingkatan_id = t.id
			WHERE mb.pengajar_id = $1
			UNION ALL
			SELECT 3, INITCAP(pb.peran),
			       t.nama || ' / Kelas ' || k.nama || ' / Bagian ' || b.nama_bagian,
			       pb.tahun_ajaran
			FROM pengajar_bagian pb
			JOIN bagian b ON pb.bagian_id = b.id
			JOIN kelas k ON b.kelas_id = k.id
			JOIN tingkatan t ON b.tingkatan_id = t.id
			WHERE pb.pengajar_id = $1
		) x
		ORDER BY urut, tahun_ajaran DESC, penugasan`

	rows, err := config.DB.Query(ctx, query, pengajarID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var jenis, penugasan, tahunAjaran string
		if err := rows.Scan(&jenis, &penugasan, &tahunAjaran); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"jenis":        jenis,
			"penugasan":    penugasan,
			"tahun_ajaran": tahunAjaran,
		})
	}
	return result, nil
}

func DeletePengajarBagian(ctx context.Context, id int) error {
	_, err := config.DB.Exec(ctx, "DELETE FROM pengajar_bagian WHERE id = $1", id)
	return err
}
