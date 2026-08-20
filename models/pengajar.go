package models

import (
	"context"
	"time"

	"github.com/mubtadiaat/app/config"
)

type Pengajar struct {
	ID            int        `json:"id"`
	Nama          string     `json:"nama"`
	NamaArab      *string    `json:"nama_arab"`
	Status        *string    `json:"status"`
	NoHP          *string    `json:"no_hp"`
	Alamat        *string    `json:"alamat"`
	TTL           *string    `json:"ttl"`
	NamaWali      *string    `json:"nama_wali"`
	TahunMengajar *string    `json:"tahun_mengajar"`
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UserRoles     *string    `json:"user_roles"`
}

type DewanHarian struct {
	ID         int     `json:"id"`
	Nama       string  `json:"nama"`
	NamaWali   *string `json:"nama_wali"`
	NoHP       *string `json:"no_hp"`
	Alamat     *string `json:"alamat"`
	Jabatan    string  `json:"jabatan"`
	Lembaga    string  `json:"lembaga"`
	TahunAktif string  `json:"tahun_aktif"`
	IsActive   bool    `json:"is_active"`
}

func GetAllPengajar(ctx context.Context, roles []string, pengajarID *int, bagianID int, tingkatanID int, kelasID int) ([]Pengajar, error) {
	query := `SELECT p.id, p.nama, p.nama_arab, p.status, p.no_hp, p.alamat, p.ttl, p.nama_wali, p.tahun_mengajar, p.is_active, p.created_at,
		(SELECT string_agg(DISTINCT ur.role, ',' ORDER BY ur.role) FROM user_roles ur JOIN users u ON ur.user_id = u.id WHERE u.pengajar_id = p.id AND u.username NOT LIKE '%__deleted_%') as user_roles
		FROM pengajar p WHERE p.is_active = true`
	args := []interface{}{}

	if bagianID > 0 {
		args = append(args, bagianID)
		query += ` AND (
			EXISTS (SELECT 1 FROM jadwal_pelajaran jp WHERE jp.pengajar_id = p.id AND jp.bagian_id = $1)
			OR EXISTS (SELECT 1 FROM pengajar_bagian pb WHERE pb.pengajar_id = p.id AND pb.bagian_id = $1)
		)`
	} else if tingkatanID > 0 && kelasID > 0 {
		args = append(args, tingkatanID, kelasID)
		query += ` AND EXISTS (
			SELECT 1 FROM bagian b
			WHERE b.tingkatan_id = $1 AND b.kelas_id = $2
			AND (
				EXISTS (SELECT 1 FROM mustahiq_bagian mb WHERE mb.pengajar_id = p.id AND mb.bagian_id = b.id)
				OR EXISTS (SELECT 1 FROM pengajar_bagian pb WHERE pb.pengajar_id = p.id AND pb.bagian_id = b.id AND pb.peran = 'munawwib')
			)
		)`
	}

	query += " ORDER BY p.nama ASC"
	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := []Pengajar{}
	for rows.Next() {
		var p Pengajar
		if err := rows.Scan(&p.ID, &p.Nama, &p.NamaArab, &p.Status, &p.NoHP, &p.Alamat, &p.TTL, &p.NamaWali, &p.TahunMengajar, &p.IsActive, &p.CreatedAt, &p.UserRoles); err != nil {
			return nil, err
		}
		res = append(res, p)
	}
	return res, nil
}

func CreatePengajar(ctx context.Context, p Pengajar) error {
	_, err := config.DB.Exec(ctx,
		`INSERT INTO pengajar (nama, nama_arab, status, no_hp, alamat, ttl, nama_wali, tahun_mengajar, is_active) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`, p.Nama, p.NamaArab, p.Status, p.NoHP, p.Alamat, p.TTL, p.NamaWali, p.TahunMengajar)
	return err
}

func AssignDewanHarian(ctx context.Context, dh DewanHarian) error {
	_, err := config.DB.Exec(ctx,
		`INSERT INTO dewan_harian (nama, nama_wali, no_hp, alamat, jabatan, lembaga, tahun_aktif, is_active) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
		dh.Nama, dh.NamaWali, dh.NoHP, dh.Alamat, dh.Jabatan, dh.Lembaga, dh.TahunAktif)
	return err
}

func GetDewanHarian(ctx context.Context, tahunAktif string) ([]DewanHarian, error) {
	// Bila tahunAktif kosong (frontend memuat semua), tampilkan seluruh pengurus
	// yang masih aktif tanpa memfilter tahun. Bila diisi, batasi ke tahun tsb.
	// Selalu kecualikan baris yang sudah di-nonaktifkan (soft delete).
	query := `SELECT id, nama, nama_wali, no_hp, alamat, jabatan, lembaga, tahun_aktif, is_active
		 FROM dewan_harian
		 WHERE is_active = true`
	args := []interface{}{}
	if tahunAktif != "" {
		query += ` AND tahun_aktif ILIKE $1`
		args = append(args, "%"+tahunAktif+"%")
	}
	query += ` ORDER BY tahun_aktif DESC, lembaga ASC, jabatan ASC`

	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []DewanHarian{}
	for rows.Next() {
		var dh DewanHarian
		if err := rows.Scan(&dh.ID, &dh.Nama, &dh.NamaWali, &dh.NoHP, &dh.Alamat, &dh.Jabatan, &dh.Lembaga, &dh.TahunAktif, &dh.IsActive); err != nil {
			return nil, err
		}
		result = append(result, dh)
	}
	return result, nil
}

func UpdatePengajar(ctx context.Context, id int, p Pengajar) error {
	_, err := config.DB.Exec(ctx,
		`UPDATE pengajar 
		 SET nama=$1, nama_arab=$2, status=$3, no_hp=$4, alamat=$5, ttl=$6, nama_wali=$7, tahun_mengajar=$8, is_active=$9, updated_at=CURRENT_TIMESTAMP 
		 WHERE id=$10`, p.Nama, p.NamaArab, p.Status, p.NoHP, p.Alamat, p.TTL, p.NamaWali, p.TahunMengajar, p.IsActive, id)
	return err
}

func DeletePengajar(ctx context.Context, id int) error {
	_, err := config.DB.Exec(ctx, `UPDATE pengajar SET is_active=false WHERE id=$1`, id)
	return err
}

func UpdateDewanHarian(ctx context.Context, id int, dh DewanHarian) error {
	_, err := config.DB.Exec(ctx,
		`UPDATE dewan_harian 
		 SET nama=$1, nama_wali=$2, no_hp=$3, alamat=$4, jabatan=$5, lembaga=$6, is_active=$7, tahun_aktif=$8, updated_at=CURRENT_TIMESTAMP 
		 WHERE id=$9`, dh.Nama, dh.NamaWali, dh.NoHP, dh.Alamat, dh.Jabatan, dh.Lembaga, dh.IsActive, dh.TahunAktif, id)
	return err
}

func DeleteDewanHarian(ctx context.Context, id int) error {
	_, err := config.DB.Exec(ctx, `UPDATE dewan_harian SET is_active=false WHERE id=$1`, id)
	return err
}
func GetPengajarByID(ctx context.Context, id int) (*Pengajar, error) {
	query := "SELECT id, nama, nama_arab, status, no_hp, alamat, ttl, nama_wali, tahun_mengajar, is_active, created_at FROM pengajar WHERE id = $1 AND is_active = true"
	
	row := config.DB.QueryRow(ctx, query, id)
	var p Pengajar
	err := row.Scan(&p.ID, &p.Nama, &p.NamaArab, &p.Status, &p.NoHP, &p.Alamat, &p.TTL, &p.NamaWali, &p.TahunMengajar, &p.IsActive, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	
	return &p, nil
}
