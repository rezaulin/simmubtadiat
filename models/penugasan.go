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
			"id": id,
			"nama_pengajar": nama,
			"nama_bagian": bagian,
			"peran": peran,
			"tahun_ajaran": tahunAjaran,
			"bagian_id": bagianID,
			"pengajar_id": pengajarID,
		})
	}
	return result, nil
}

func DeletePengajarBagian(ctx context.Context, id int) error {
	_, err := config.DB.Exec(ctx, "DELETE FROM pengajar_bagian WHERE id = $1", id)
	return err
}
