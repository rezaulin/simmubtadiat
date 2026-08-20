package models

import (
	"context"

	"github.com/mubtadiaat/app/config"
)

// Assign Mufatish to Kelas (replacing the old one for this tingkatan+kelas)
func AssignMufatish(ctx context.Context, pengajarID, kelasID, tingkatanID int) error {
	tahunAjaran := GetTahunAjaranAktif(ctx)
	if tahunAjaran == "" {
		tahunAjaran = "2024/2025" // Fallback
	}
	
	query := `
		INSERT INTO mufatish_kelas (pengajar_id, kelas_id, tingkatan_id, user_id, tahun_ajaran) 
		VALUES ($1, $2, $3, (SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id WHERE u.pengajar_id = $1 AND ur.role = 'mufatish' AND u.username NOT LIKE '%__deleted_%' LIMIT 1), $4)
		ON CONFLICT (kelas_id, tingkatan_id) DO UPDATE SET 
		  pengajar_id = EXCLUDED.pengajar_id, 
		  user_id = EXCLUDED.user_id,
		  tahun_ajaran = EXCLUDED.tahun_ajaran,
		  created_at = NOW()
	`
	_, err := config.DB.Exec(ctx, query, pengajarID, kelasID, tingkatanID, tahunAjaran)
	return err
}

func RevokeMufatish(ctx context.Context, kelasID, tingkatanID int) error {
	_, err := config.DB.Exec(ctx, "DELETE FROM mufatish_kelas WHERE kelas_id = $1 AND tingkatan_id = $2", kelasID, tingkatanID)
	return err
}

// Get Mufatish assignments
func GetMufatishAssignments(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT mk.id, mk.pengajar_id, p.nama as pengajar_nama,
		       t.id as tingkatan_id, t.nama as tingkatan_nama, k.id as kelas_id, k.nama as kelas_nama
		FROM mufatish_kelas mk
		JOIN pengajar p ON mk.pengajar_id = p.id
		JOIN kelas k ON mk.kelas_id = k.id
		JOIN tingkatan t ON mk.tingkatan_id = t.id
	`
	rows, err := config.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var id, pengajarID, tingkatanID, kelasID int
		var pengajarNama, tingkatanNama, kelasNama string
		if err := rows.Scan(&id, &pengajarID, &pengajarNama, &tingkatanID, &tingkatanNama, &kelasID, &kelasNama); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"id":             id,
			"pengajar_id":    pengajarID,
			"pengajar_nama":  pengajarNama,
			"tingkatan_id":   tingkatanID,
			"tingkatan_nama": tingkatanNama,
			"kelas_id":       kelasID,
			"kelas_nama":     kelasNama,
		})
	}
	return result, nil
}

func AssignMustahiq(ctx context.Context, pengajarID, bagianID int) error {
	query := `
		INSERT INTO mustahiq_bagian (pengajar_id, bagian_id, user_id, tahun_ajaran) 
		VALUES ($1, $2, (SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id WHERE u.pengajar_id = $1 AND ur.role = 'mustahiq' AND u.username NOT LIKE '%__deleted_%' LIMIT 1), $3)
		ON CONFLICT (bagian_id) DO UPDATE SET 
		  pengajar_id = EXCLUDED.pengajar_id, 
		  user_id = EXCLUDED.user_id,
		  tahun_ajaran = EXCLUDED.tahun_ajaran,
		  created_at = NOW()
	`
	_, err := config.DB.Exec(ctx, query, pengajarID, bagianID, "2024/2025")
	return err
}

func RevokeMustahiq(ctx context.Context, bagianID int) error {
	_, err := config.DB.Exec(ctx, "DELETE FROM mustahiq_bagian WHERE bagian_id = $1", bagianID)
	return err
}

// Get Mustahiq assignments
func GetMustahiqAssignments(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT mb.id, mb.pengajar_id, p.nama as pengajar_nama, mb.bagian_id, b.nama_bagian as bagian_nama,
		       t.id as tingkatan_id, t.nama as tingkatan_nama, k.id as kelas_id, k.nama as kelas_nama
		FROM mustahiq_bagian mb
		JOIN pengajar p ON mb.pengajar_id = p.id
		JOIN bagian b ON mb.bagian_id = b.id
		JOIN kelas k ON b.kelas_id = k.id
		JOIN tingkatan t ON b.tingkatan_id = t.id
	`
	rows, err := config.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var id, pengajarID, bagianID, tingkatanID, kelasID int
		var pengajarNama, bagianNama, tingkatanNama, kelasNama string
		if err := rows.Scan(&id, &pengajarID, &pengajarNama, &bagianID, &bagianNama, &tingkatanID, &tingkatanNama, &kelasID, &kelasNama); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"id":             id,
			"pengajar_id":    pengajarID,
			"pengajar_nama":  pengajarNama,
			"bagian_id":      bagianID,
			"bagian_nama":    bagianNama,
			"tingkatan_id":   tingkatanID,
			"tingkatan_nama": tingkatanNama,
			"kelas_id":       kelasID,
			"kelas_nama":     kelasNama,
		})
	}
	return result, nil
}

func AssignMunawwibs(ctx context.Context, bagianID int, pengajarIDs []int) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Hapus penugasan munawwib yang lama di bagian ini
	_, err = tx.Exec(ctx, "DELETE FROM pengajar_bagian WHERE bagian_id = $1 AND peran = 'munawwib'", bagianID)
	if err != nil {
		return err
	}

	// Insert yang baru
	for _, pid := range pengajarIDs {
		_, err = tx.Exec(ctx, "INSERT INTO pengajar_bagian (pengajar_id, bagian_id, tahun_ajaran, peran) VALUES ($1, $2, $3, 'munawwib')", pid, bagianID, "2024/2025")
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func GetMunawwibAssignments(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT pb.bagian_id, pb.pengajar_id, p.nama as pengajar_nama 
		FROM pengajar_bagian pb
		JOIN pengajar p ON p.id = pb.pengajar_id
		WHERE pb.peran = 'munawwib'
	`
	rows, err := config.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var bagianID, pengajarID int
		var pengajarNama string
		if err := rows.Scan(&bagianID, &pengajarID, &pengajarNama); err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"bagian_id": bagianID,
			"pengajar_id": pengajarID,
			"pengajar_nama": pengajarNama,
		})
	}
	return result, nil
}


func RemoveMunawwib(ctx context.Context, bagianID, pengajarID int) error {
	_, err := config.DB.Exec(ctx, "DELETE FROM pengajar_bagian WHERE bagian_id = $1 AND pengajar_id = $2 AND peran = 'munawwib'", bagianID, pengajarID)
	return err
}

