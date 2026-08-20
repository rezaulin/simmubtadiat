package models

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/mubtadiaat/app/config"
)

// CatatanSantri = satu entri pelanggaran/prestasi.
type CatatanSantri struct {
	ID          int     `json:"id"`
	SantriID    int     `json:"santri_id"`
	SantriNama  string  `json:"santri_nama,omitempty"`
	BagianNama  string  `json:"bagian_nama,omitempty"`
	Jenis       string  `json:"jenis"` // pelanggaran | prestasi
	Tanggal     string  `json:"tanggal"`
	Kategori    *string `json:"kategori"`
	Deskripsi   string  `json:"deskripsi"`
	TahunAjaran *string `json:"tahun_ajaran"`
	Pencatat    *string `json:"pencatat,omitempty"`
	CreatedAt   string  `json:"created_at,omitempty"`
}

// CatatanInput = payload pembuatan catatan.
type CatatanInput struct {
	SantriID  int    `json:"santri_id"`
	Jenis     string `json:"jenis"`
	Tanggal   string `json:"tanggal"`
	Kategori  string `json:"kategori"`
	Deskripsi string `json:"deskripsi"`
}

// RekapCatatan = agregasi catatan per santri.
type RekapCatatan struct {
	SantriID         int    `json:"santri_id"`
	SantriNama       string `json:"santri_nama"`
	Tingkatan        string `json:"tingkatan"`
	Kelas            string `json:"kelas"`
	BagianNama       string `json:"bagian_nama,omitempty"`
	TotalPelanggaran int    `json:"total_pelanggaran"`
	TotalPrestasi    int    `json:"total_prestasi"`
}

func validJenisCatatan(j string) bool {
	return j == "pelanggaran" || j == "prestasi"
}

// mustahiqPunyaSantri memeriksa apakah santri berada di salah satu bagian yang
// diampu mustahiq (via mustahiq_bagian).
func mustahiqPunyaSantri(ctx context.Context, pengajarID, santriID int) (bool, error) {
	var cnt int
	err := config.DB.QueryRow(ctx,
		`SELECT COUNT(1)
		 FROM santri s
		 JOIN bagian b ON s.bagian_id = b.id
		 WHERE s.id = $1 AND EXISTS (
			SELECT 1 FROM bagian b_mus
			JOIN mustahiq_bagian mb ON mb.bagian_id = b_mus.id
			WHERE mb.pengajar_id = $2 AND b_mus.tingkatan_id = b.tingkatan_id AND b_mus.kelas_id = b.kelas_id
		 )`, santriID, pengajarID).Scan(&cnt)
	if err != nil {
		return false, err
	}
	return cnt > 0, nil
}

func CreateCatatan(ctx context.Context, in CatatanInput, roles []string, userID int, pengajarID *int) error {
	if in.SantriID <= 0 {
		return errors.New("santri_id wajib")
	}
	if !validJenisCatatan(in.Jenis) {
		return errors.New("jenis harus 'pelanggaran' atau 'prestasi'")
	}
	if in.Tanggal == "" {
		return errors.New("tanggal wajib")
	}
	if strings.TrimSpace(in.Deskripsi) == "" {
		return errors.New("deskripsi wajib")
	}

	isGlobal := false
	for _, role := range roles {
		if role == "pimpinan" || role == "muroqib" {
			isGlobal = true
			break
		}
	}

	if !isGlobal {
		hasAccess := false
		for _, role := range roles {
			if role == "muroqib" {
				if pengajarID != nil {
					ta := GetTahunAjaranAktif(ctx)
					ok, err := CheckMuroqibScope(ctx, *pengajarID, in.SantriID, ta)
					if err == nil && ok {
						hasAccess = true
						break
					}
				}
			}
		}
		if !hasAccess {
			return errors.New("akses ditolak: santri bukan di kamar yang Anda ampu")
		}
	}

	var kategori *string
	if strings.TrimSpace(in.Kategori) != "" {
		k := strings.TrimSpace(in.Kategori)
		kategori = &k
	}

	ta := GetTahunAjaranAktif(ctx)

	_, err := config.DB.Exec(ctx,
		`INSERT INTO catatan_santri (santri_id, jenis, tanggal, kategori, deskripsi, tahun_ajaran, pengajar_id, user_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		in.SantriID, in.Jenis, in.Tanggal, kategori, strings.TrimSpace(in.Deskripsi), ta, pengajarID, userID)
	return err
}

// GetCatatanBySantri mengembalikan seluruh catatan seorang santri (untuk detail).
func GetCatatanBySantri(ctx context.Context, santriID int) ([]CatatanSantri, error) {
	rows, err := config.DB.Query(ctx,
		`SELECT c.id, c.santri_id, c.jenis, to_char(c.tanggal, 'YYYY-MM-DD'), c.kategori, c.deskripsi,
		        c.tahun_ajaran, COALESCE(p.nama, u.nama)
		 FROM catatan_santri c
		 LEFT JOIN pengajar p ON c.pengajar_id = p.id
		 LEFT JOIN users u ON c.user_id = u.id
		 WHERE c.santri_id = $1
		 ORDER BY c.tanggal DESC, c.id DESC`, santriID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCatatan(rows)
}

// ListCatatan mengembalikan daftar catatan dengan filter opsional (untuk menu khusus).
func ListCatatan(ctx context.Context, jenis, keyword string) ([]CatatanSantri, error) {
	q := `SELECT c.id, c.santri_id, s.nama, COALESCE(b.nama_bagian, ''), c.jenis,
	             to_char(c.tanggal, 'YYYY-MM-DD'), c.kategori, c.deskripsi, c.tahun_ajaran,
	             COALESCE(p.nama, u.nama)
	      FROM catatan_santri c
	      JOIN santri s ON c.santri_id = s.id
	      LEFT JOIN bagian b ON s.bagian_id = b.id
	      LEFT JOIN pengajar p ON c.pengajar_id = p.id
	      LEFT JOIN users u ON c.user_id = u.id
	      WHERE 1=1`
	args := []interface{}{}
	if jenis == "pelanggaran" || jenis == "prestasi" {
		args = append(args, jenis)
		q += " AND c.jenis = $" + strconv.Itoa(len(args))
	}
	if strings.TrimSpace(keyword) != "" {
		args = append(args, "%"+strings.TrimSpace(keyword)+"%")
		p := strconv.Itoa(len(args))
		q += " AND (s.nama ILIKE $" + p + " OR c.deskripsi ILIKE $" + p + " OR c.kategori ILIKE $" + p + ")"
	}
	q += " ORDER BY c.tanggal DESC, c.id DESC LIMIT 500"

	rows, err := config.DB.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCatatanFull(rows)
}

// GetRekapCatatan mengembalikan agregat catatan per santri.
func GetRekapCatatan(ctx context.Context, keyword string, roles []string, pengajarID *int, userID int) ([]RekapCatatan, error) {
	q := `SELECT c.santri_id, s.nama, COALESCE(t.nama, ''), COALESCE(k.nama, ''), COALESCE(b.nama_bagian, ''),
	             SUM(CASE WHEN c.jenis = 'pelanggaran' THEN 1 ELSE 0 END) AS total_pelanggaran,
	             SUM(CASE WHEN c.jenis = 'prestasi' THEN 1 ELSE 0 END) AS total_prestasi
	      FROM catatan_santri c
	      JOIN santri s ON c.santri_id = s.id
	      LEFT JOIN bagian b ON s.bagian_id = b.id
	      LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
	      LEFT JOIN kelas k ON b.kelas_id = k.id
	      WHERE 1=1`
	args := []interface{}{}

	isGlobal := false
	for _, role := range roles {
		if role == "pimpinan" || role == "admin" || role == "keamanan" || role == "muroqib" {
			isGlobal = true
			break
		}
	}

	if !isGlobal {
		var conditions []string
		for _, r := range roles {
			switch r {
			case "mufatish":
				conditions = append(conditions, `EXISTS (SELECT 1 FROM bagian b_muf JOIN mufatish_kelas mk ON b_muf.kelas_id = mk.kelas_id AND b_muf.tingkatan_id = mk.tingkatan_id WHERE b_muf.id = s.bagian_id AND (mk.user_id = $`+strconv.Itoa(len(args)+1)+` OR mk.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $`+strconv.Itoa(len(args)+1)+`)))`)
			case "mustahiq":
				conditions = append(conditions, `EXISTS (
					SELECT 1 FROM mustahiq_bagian msub 
					JOIN bagian b_msub ON msub.bagian_id = b_msub.id
					JOIN bagian b_santri ON b_santri.id = s.bagian_id
					WHERE b_msub.kelas_id = b_santri.kelas_id 
					  AND b_msub.tingkatan_id = b_santri.tingkatan_id
					  AND (msub.user_id = $`+strconv.Itoa(len(args)+1)+` OR msub.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $`+strconv.Itoa(len(args)+1)+`))
				)`)
			}
		}

		if len(conditions) > 0 {
			q += ` AND (` + strings.Join(conditions, " OR ") + `) `
			args = append(args, userID)
		} else {
			// No matching roles means no access
			q += ` AND 1 = 0 `
		}
	}

	if strings.TrimSpace(keyword) != "" {
		args = append(args, "%"+strings.TrimSpace(keyword)+"%")
		p := strconv.Itoa(len(args))
		q += " AND s.nama ILIKE $" + p
	}

	q += ` GROUP BY c.santri_id, s.nama, t.nama, k.nama, b.nama_bagian
	       ORDER BY s.nama ASC LIMIT 500`

	rows, err := config.DB.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make([]RekapCatatan, 0)
	for rows.Next() {
		var r RekapCatatan
		if err := rows.Scan(&r.SantriID, &r.SantriNama, &r.Tingkatan, &r.Kelas, &r.BagianNama, &r.TotalPelanggaran, &r.TotalPrestasi); err != nil {
			return nil, err
		}
		res = append(res, r)
	}
	return res, nil
}

// DeleteCatatan menghapus catatan. pimpinan/admin bebas; mustahiq hanya catatan
// yang ia buat sendiri.
func DeleteCatatan(ctx context.Context, id int, roles []string, userID int) error {
	isGlobal := false
	for _, role := range roles {
		if role == "pimpinan" {
			isGlobal = true
			break
		}
	}

	if !isGlobal {
		hasAccess := false
		for _, role := range roles {
			if role == "muroqib" {
				var ownerID int
				err := config.DB.QueryRow(ctx, "SELECT user_id FROM catatan_santri WHERE id = $1", id).Scan(&ownerID)
				if err == nil && ownerID == userID {
					hasAccess = true
					break
				}
			}
		}
		if !hasAccess {
			return errors.New("akses ditolak: Anda hanya dapat menghapus catatan yang Anda buat sendiri")
		}
	}

	_, err := config.DB.Exec(ctx, "DELETE FROM catatan_santri WHERE id = $1", id)
	return err
}

// scanCatatan memindai baris untuk GetCatatanBySantri (tanpa kolom santri/bagian).
func scanCatatan(rows interface {
	Next() bool
	Scan(...interface{}) error
}) ([]CatatanSantri, error) {
	res := make([]CatatanSantri, 0)
	for rows.Next() {
		var c CatatanSantri
		var pencatat *string
		if err := rows.Scan(&c.ID, &c.SantriID, &c.Jenis, &c.Tanggal, &c.Kategori, &c.Deskripsi, &c.TahunAjaran, &pencatat); err != nil {
			return nil, err
		}
		c.Pencatat = pencatat
		res = append(res, c)
	}
	return res, nil
}

// scanCatatanFull memindai baris untuk ListCatatan (dengan nama santri & bagian).
func scanCatatanFull(rows interface {
	Next() bool
	Scan(...interface{}) error
}) ([]CatatanSantri, error) {
	res := make([]CatatanSantri, 0)
	for rows.Next() {
		var c CatatanSantri
		var pencatat *string
		if err := rows.Scan(&c.ID, &c.SantriID, &c.SantriNama, &c.BagianNama, &c.Jenis, &c.Tanggal, &c.Kategori, &c.Deskripsi, &c.TahunAjaran, &pencatat); err != nil {
			return nil, err
		}
		c.Pencatat = pencatat
		res = append(res, c)
	}
	return res, nil
}

// itoa kecil tanpa import strconv berulang di query builder.
func itoa(n int) string {
	return strings.TrimSpace(string(rune('0'+n))) // hanya dipakai untuk index 1..9
}
