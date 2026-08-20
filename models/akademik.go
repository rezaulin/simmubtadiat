package models

import (
	"context"
	"time"

	"github.com/mubtadiaat/app/config"
)

type Tingkatan struct {
	ID        int       `json:"id"`
	Nama      string    `json:"nama"`
	Urutan    int       `json:"urutan"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Kelas struct {
	ID         int       `json:"id"`
	Nama       string    `json:"nama"`
	TahunMasuk string    `json:"tahun_masuk"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
}

type Bagian struct {
	ID          int       `json:"id"`
	KelasID     int       `json:"kelas_id"`
	TingkatanID int       `json:"tingkatan_id"`
	NamaBagian  string    `json:"nama_bagian"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	Tingkatan   string    `json:"tingkatan,omitempty"`
	Kelas       string    `json:"kelas,omitempty"`
	CanEditNilai bool      `json:"can_edit_nilai"`
	CanEditAbsensi bool    `json:"can_edit_absensi"`
}

// --- Tingkatan ---

func GetAllTingkatan(ctx context.Context) ([]Tingkatan, error) {
	rows, err := config.DB.Query(ctx, "SELECT id, nama, urutan, is_active, created_at FROM tingkatan ORDER BY urutan ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []Tingkatan{}
	for rows.Next() {
		var t Tingkatan
		if err := rows.Scan(&t.ID, &t.Nama, &t.Urutan, &t.IsActive, &t.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, nil
}

func CreateTingkatan(ctx context.Context, nama string, urutan int) error {
	_, err := config.DB.Exec(ctx, "INSERT INTO tingkatan (nama, urutan) VALUES ($1, $2)", nama, urutan)
	return err
}

func UpdateTingkatan(ctx context.Context, id int, nama string, urutan int, isActive bool) error {
	_, err := config.DB.Exec(ctx, "UPDATE tingkatan SET nama=$1, urutan=$2, is_active=$3 WHERE id=$4", nama, urutan, isActive, id)
	return err
}

func DeleteTingkatan(ctx context.Context, id int) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Set santri bagian_id to null for parts belonging to this tingkatan
	_, err = tx.Exec(ctx, "UPDATE santri SET bagian_id = NULL WHERE bagian_id IN (SELECT id FROM bagian WHERE tingkatan_id = $1)", id)
	if err != nil { return err }

	// Delete jadwal for parts belonging to this tingkatan
	_, err = tx.Exec(ctx, "DELETE FROM jadwal_pelajaran WHERE bagian_id IN (SELECT id FROM bagian WHERE tingkatan_id = $1)", id)
	if err != nil { return err }

	// Delete mapel
	_, err = tx.Exec(ctx, "DELETE FROM mata_pelajaran WHERE tingkatan_id = $1", id)
	if err != nil { return err }

	// Delete bagian
	_, err = tx.Exec(ctx, "DELETE FROM bagian WHERE tingkatan_id = $1", id)
	if err != nil { return err }

	_, err = tx.Exec(ctx, "DELETE FROM tingkatan WHERE id=$1", id)
	if err != nil { return err }

	return tx.Commit(ctx)
}

// --- Kelas ---

func GetAllKelas(ctx context.Context) ([]Kelas, error) {
	rows, err := config.DB.Query(ctx, "SELECT id, nama, tahun_masuk, is_active, created_at FROM kelas ORDER BY id DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []Kelas{}
	for rows.Next() {
		var a Kelas
		if err := rows.Scan(&a.ID, &a.Nama, &a.TahunMasuk, &a.IsActive, &a.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, a)
	}
	return result, nil
}

func CreateKelas(ctx context.Context, nama, tahunMasuk string) error {
	_, err := config.DB.Exec(ctx, "INSERT INTO kelas (nama, tahun_masuk) VALUES ($1, $2)", nama, tahunMasuk)
	return err
}

func UpdateKelas(ctx context.Context, id int, nama, tahunMasuk string, isActive bool) error {
	_, err := config.DB.Exec(ctx, "UPDATE kelas SET nama=$1, tahun_masuk=$2, is_active=$3 WHERE id=$4", nama, tahunMasuk, isActive, id)
	return err
}

func DeleteKelas(ctx context.Context, id int) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Set santri bagian_id to null for parts belonging to this kelas
	_, err = tx.Exec(ctx, "UPDATE santri SET bagian_id = NULL WHERE bagian_id IN (SELECT id FROM bagian WHERE kelas_id = $1)", id)
	if err != nil { return err }

	// Delete jadwal for parts belonging to this kelas
	_, err = tx.Exec(ctx, "DELETE FROM jadwal_pelajaran WHERE bagian_id IN (SELECT id FROM bagian WHERE kelas_id = $1)", id)
	if err != nil { return err }

	// Delete mapel
	_, err = tx.Exec(ctx, "DELETE FROM mata_pelajaran WHERE kelas_id = $1", id)
	if err != nil { return err }

	// Delete bagian
	_, err = tx.Exec(ctx, "DELETE FROM bagian WHERE kelas_id = $1", id)
	if err != nil { return err }

	_, err = tx.Exec(ctx, "DELETE FROM kelas WHERE id=$1", id)
	if err != nil { return err }

	return tx.Commit(ctx)
}

// --- Bagian ---

func GetBagian(ctx context.Context) ([]Bagian, error) {
	rows, err := config.DB.Query(ctx, `
		SELECT b.id, b.kelas_id, b.tingkatan_id, b.nama_bagian, b.is_active, b.created_at,
		       t.nama as tingkatan, k.nama as kelas
		FROM bagian b
		LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		LEFT JOIN kelas k ON b.kelas_id = k.id
		ORDER BY t.urutan DESC, k.nama ASC, b.nama_bagian ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []Bagian{}
	for rows.Next() {
		var b Bagian
		var tingkatan, kelas *string
		if err := rows.Scan(&b.ID, &b.KelasID, &b.TingkatanID, &b.NamaBagian, &b.IsActive, &b.CreatedAt, &tingkatan, &kelas); err != nil {
			return nil, err
		}
		if tingkatan != nil {
			b.Tingkatan = *tingkatan
		}
		if kelas != nil {
			b.Kelas = *kelas
		}
		result = append(result, b)
	}
	return result, nil
}

func CreateBagian(ctx context.Context, kelasID, tingkatanID int, namaBagian string) error {
	_, err := config.DB.Exec(ctx, "INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1, $2, $3)", kelasID, tingkatanID, namaBagian)
	return err
}

func UpdateBagian(ctx context.Context, id int, kelasID, tingkatanID int, namaBagian string, isActive bool) error {
	_, err := config.DB.Exec(ctx, "UPDATE bagian SET kelas_id=$1, tingkatan_id=$2, nama_bagian=$3, is_active=$4 WHERE id=$5", kelasID, tingkatanID, namaBagian, isActive, id)
	return err
}

func DeleteBagian(ctx context.Context, id int) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Update santri
	_, err = tx.Exec(ctx, "UPDATE santri SET bagian_id = NULL WHERE bagian_id = $1", id)
	if err != nil { return err }

	// Delete jadwal
	_, err = tx.Exec(ctx, "DELETE FROM jadwal_pelajaran WHERE bagian_id = $1", id)
	if err != nil { return err }

	_, err = tx.Exec(ctx, "DELETE FROM bagian WHERE id=$1", id)
	if err != nil { return err }

	return tx.Commit(ctx)
}

// GetBagianByPengajarID returns bagian assigned to a specific pengajar via pengajar_bagian OR jadwal_pelajaran
func GetBagianByPengajarID(ctx context.Context, pengajarID int, tahunAjaran string) ([]Bagian, error) {
	query := `
		SELECT DISTINCT b.id, b.kelas_id, b.tingkatan_id, b.nama_bagian, b.is_active, b.created_at,
		       t.nama as tingkatan, k.nama as kelas, COALESCE(t.urutan, 0) as urutan,
		       EXISTS (SELECT 1 FROM mufatish_kelas mk WHERE mk.kelas_id = b.kelas_id AND mk.tingkatan_id = b.tingkatan_id AND mk.pengajar_id = $1) as can_edit_absensi
		FROM bagian b
		LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		LEFT JOIN kelas k ON b.kelas_id = k.id
		WHERE b.is_active = true AND (
			EXISTS (
				SELECT 1 FROM bagian b2 
				WHERE b2.kelas_id = b.kelas_id AND b2.tingkatan_id = b.tingkatan_id AND b2.is_active = true AND (
					EXISTS (SELECT 1 FROM pengajar_bagian pb WHERE pb.bagian_id = b2.id AND pb.pengajar_id = $1 AND ($2 = '' OR pb.tahun_ajaran = $2))
					OR EXISTS (SELECT 1 FROM jadwal_pelajaran jp WHERE jp.bagian_id = b2.id AND jp.pengajar_id = $1)
					OR EXISTS (SELECT 1 FROM mustahiq_bagian mb WHERE mb.bagian_id = b2.id AND mb.pengajar_id = $1 AND ($2 = '' OR mb.tahun_ajaran = $2))
				)
			)
			OR EXISTS (SELECT 1 FROM mufatish_kelas mk WHERE mk.kelas_id = b.kelas_id AND mk.tingkatan_id = b.tingkatan_id AND mk.pengajar_id = $1)
		)
		ORDER BY urutan ASC, b.id ASC
	`
	rows, err := config.DB.Query(ctx, query, pengajarID, tahunAjaran)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []Bagian{}
	for rows.Next() {
		var b Bagian
		var tingkatan, kelas *string
		var urutan int
		if err := rows.Scan(&b.ID, &b.KelasID, &b.TingkatanID, &b.NamaBagian, &b.IsActive, &b.CreatedAt, &tingkatan, &kelas, &urutan, &b.CanEditAbsensi); err != nil {
			return nil, err
		}
		if tingkatan != nil {
			b.Tingkatan = *tingkatan
		}
		if kelas != nil {
			b.Kelas = *kelas
		}
		b.CanEditNilai = b.CanEditAbsensi // Mufatish can also edit nilai
		result = append(result, b)
	}
	return result, nil
}
