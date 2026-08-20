package models

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/mubtadiaat/app/config"
)

type Santri struct {
	ID               int             `json:"id"`
	NIK              string          `json:"nik"`
	NomorStambukUrut *int            `json:"nomor_stambuk_urut,omitempty"`
	Stambuk          *string         `json:"stambuk"`
	NISN             *string         `json:"nisn"`
	Nama             string          `json:"nama"`
	NamaWali         *string         `json:"nama_wali"`
	TTLTempat        *string         `json:"ttl_tempat"`
	TTLTanggal       *time.Time      `json:"ttl_tanggal"`
	Alamat           *string         `json:"alamat"`
	NoHPWali         *string         `json:"no_hp_wali"`
	Kamar            *string         `json:"kamar"`
	BagianID         *int            `json:"bagian_id"`
	Status           string          `json:"status"` // aktif, cuti, boyong, lulus, keluar
	TanggalStatus    *time.Time      `json:"tanggal_status"`
	FotoURL          *string         `json:"foto_url"`
	Extra            json.RawMessage `json:"extra"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	TingkatanNama    *string         `json:"tingkatan_nama,omitempty"`
	BagianNama       *string         `json:"bagian_nama,omitempty"`
	KelasNama        *string         `json:"kelas_nama,omitempty"`

	// Alamat berjenjang (Provinsi -> Kabupaten -> Kecamatan) + desa manual.
	ProvinsiKode  *string `json:"provinsi_kode"`
	ProvinsiNama  *string `json:"provinsi_nama"`
	KabupatenKode *string `json:"kabupaten_kode"`
	KabupatenNama *string `json:"kabupaten_nama"`
	KecamatanKode *string `json:"kecamatan_kode"`
	KecamatanNama *string `json:"kecamatan_nama"`
	Desa          *string `json:"desa"`

	// Data khidmah (pengabdian). Semua nullable; terisi hanya untuk santri yang
	// menempuh/pernah menempuh pengabdian.
	KhidmahTempat  *string    `json:"khidmah_tempat"`
	KhidmahMulai   *time.Time `json:"khidmah_mulai"`
	KhidmahSelesai *time.Time `json:"khidmah_selesai"`

	// Tahun masuk/keluar — otomatis terisi.
	TahunMasuk  *string `json:"tahun_masuk"`
	TahunKeluar *string `json:"tahun_keluar"`

	LastBagianID    *int    `json:"last_bagian_id"`
	LastTahunAjaran *string `json:"last_tahun_ajaran"`
}

// SantriFilter berisi filter opsional untuk daftar santri aktif.
type SantriFilter struct {
	ProvinsiKode  string
	KabupatenKode string
	TingkatanID   int
}

// SantriArsipFilter berisi filter untuk daftar arsip santri.
type SantriArsipFilter struct {
	Status      string
	TingkatanID int
	KelasID     int
	BagianID    int
	TahunAjaran string
}

// santriSelectCols adalah daftar kolom lengkap yang dipakai bersama beberapa query.
const santriSelectCols = `s.id, s.nik, s.stambuk, s.nisn, s.nama, s.nama_wali, s.ttl_tempat, s.ttl_tanggal, s.alamat, s.no_hp_wali, s.bagian_id, s.status, s.tanggal_status, s.foto_url, s.extra, s.created_at, s.updated_at,
	s.provinsi_kode, s.provinsi_nama, s.kabupaten_kode, s.kabupaten_nama, s.kecamatan_kode, s.kecamatan_nama, s.desa,
	s.khidmah_tempat, s.khidmah_mulai, s.khidmah_selesai,
	s.tahun_masuk, s.tahun_keluar, s.nomor_stambuk_urut, s.kamar, s.last_bagian_id, s.last_tahun_ajaran`

// scanSantriFull memindai baris dengan seluruh kolom santri termasuk wilayah dan
// (opsional) kolom nama tingkatan/bagian/kelas ketika withAkademik true.
func scanSantriFull(rows scanner, withAkademik bool) (Santri, error) {
	var s Santri
	dest := []interface{}{
		&s.ID, &s.NIK, &s.Stambuk, &s.NISN, &s.Nama, &s.NamaWali, &s.TTLTempat, &s.TTLTanggal, &s.Alamat, &s.NoHPWali, &s.BagianID, &s.Status, &s.TanggalStatus, &s.FotoURL, &s.Extra, &s.CreatedAt, &s.UpdatedAt,
		&s.ProvinsiKode, &s.ProvinsiNama, &s.KabupatenKode, &s.KabupatenNama, &s.KecamatanKode, &s.KecamatanNama, &s.Desa,
		&s.KhidmahTempat, &s.KhidmahMulai, &s.KhidmahSelesai,
		&s.TahunMasuk, &s.TahunKeluar, &s.NomorStambukUrut, &s.Kamar, &s.LastBagianID, &s.LastTahunAjaran,
	}
	if withAkademik {
		dest = append(dest, &s.TingkatanNama, &s.BagianNama, &s.KelasNama)
	}
	err := rows.Scan(dest...)
	// Stambuk diambil langsung dari kolom `stambuk` di DB — tidak di-override.
	return s, err
}

// scanner menyamakan pgx.Row dan pgx.Rows untuk Scan.
type scanner interface {
	Scan(dest ...interface{}) error
}

func GetSantriAktif(ctx context.Context, userRoles []string, userID int, filter SantriFilter) ([]Santri, error) {
	baseQuery := `SELECT ` + santriSelectCols + `,
		 t.nama, b.nama_bagian, k.nama
		 FROM santri s
		 LEFT JOIN bagian b ON s.bagian_id = b.id
		 LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		 LEFT JOIN kelas k ON b.kelas_id = k.id `

	whereClause := `WHERE s.status = 'aktif' `
	args := []interface{}{}

	isGlobal := false
	for _, r := range userRoles {
		if r == "pimpinan" || r == "admin" || r == "tim_rapot" || r == "keamanan" || r == "muroqib" {
			isGlobal = true
			break
		}
	}

	if !isGlobal {
		var conditions []string
		for _, r := range userRoles {
			switch r {
			case "mufatish":
				conditions = append(conditions, `EXISTS (SELECT 1 FROM mufatish_kelas mk WHERE mk.kelas_id = b.kelas_id AND mk.tingkatan_id = b.tingkatan_id AND (mk.user_id = $1 OR mk.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $1)))`)
			case "mustahiq":
				conditions = append(conditions, `EXISTS (
					SELECT 1 FROM bagian b_mus 
					JOIN mustahiq_bagian mb ON mb.bagian_id = b_mus.id 
					WHERE (mb.user_id = $1 OR mb.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $1)) AND b_mus.tingkatan_id = b.tingkatan_id AND b_mus.kelas_id = b.kelas_id
				)`)
			case "wali_santri":
				conditions = append(conditions, `EXISTS (SELECT 1 FROM wali_santri_link wl WHERE wl.santri_id = s.id AND wl.user_id = $1)`)
			}
		}

		if len(conditions) > 0 {
			whereClause += ` AND (` + strings.Join(conditions, " OR ") + `) `
			args = append(args, userID)
		} else {
			whereClause += ` AND 1 = 0 `
		}
	}

	// Filter opsional berdasarkan wilayah dan tingkatan.
	if filter.ProvinsiKode != "" {
		whereClause += ` AND s.provinsi_kode = $` + strconv.Itoa(len(args)+1) + ` `
		args = append(args, filter.ProvinsiKode)
	}
	if filter.KabupatenKode != "" {
		whereClause += ` AND s.kabupaten_kode = $` + strconv.Itoa(len(args)+1) + ` `
		args = append(args, filter.KabupatenKode)
	}
	if filter.TingkatanID > 0 {
		whereClause += ` AND t.id = $` + strconv.Itoa(len(args)+1) + ` `
		args = append(args, filter.TingkatanID)
	}

	query := baseQuery + whereClause + ` ORDER BY s.nama ASC`
	rows, err := config.DB.Query(ctx, query, args...)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Santri
	for rows.Next() {
		s, err := scanSantriFull(rows, true)
		if err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

// GetSantriByBagian returns active students in a specific bagian, but only if the
// requesting user is authorized to access that bagian. Pimpinan can access any
// bagian; teachers (mustahiq/muroqib/mufatish/pengajar) can access a bagian they
// are assigned to as mustahiq, muroqib, subject teacher (jadwal), or mufatish.
// This lets a subject teacher take attendance for a class shown in their daily
// schedule even though they are not the class's mustahiq.
func GetSantriByBagian(ctx context.Context, bagianID int, userRoles []string, userID int) ([]Santri, error) {
	baseQuery := `SELECT ` + santriSelectCols + `,
		 t.nama, b.nama_bagian, k.nama
		 FROM santri s
		 LEFT JOIN bagian b ON s.bagian_id = b.id
		 LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		 LEFT JOIN kelas k ON b.kelas_id = k.id
		 WHERE s.status = 'aktif' AND s.bagian_id = $1 `

	args := []interface{}{bagianID}

	isGlobal := false
	for _, r := range userRoles {
		if r == "pimpinan" || r == "admin" || r == "tim_rapot" || r == "keamanan" || r == "muroqib" {
			isGlobal = true
			break
		}
	}

	// Pimpinan and admin bypass the authorization check. Everyone else must prove they
	// are linked to this bagian in some capacity.
	if !isGlobal {
		baseQuery += ` AND (
			EXISTS (SELECT 1 FROM pengajar_bagian pb WHERE pb.bagian_id = s.bagian_id AND pb.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $2))
			OR EXISTS (SELECT 1 FROM jadwal_pelajaran jp WHERE jp.bagian_id = s.bagian_id AND jp.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $2))
			OR EXISTS (
				SELECT 1 FROM mustahiq_bagian msub 
				JOIN bagian b_msub ON msub.bagian_id = b_msub.id
				JOIN bagian b_santri ON b_santri.id = s.bagian_id
				WHERE b_msub.kelas_id = b_santri.kelas_id 
				  AND b_msub.tingkatan_id = b_santri.tingkatan_id
				  AND (msub.user_id = $2 OR msub.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $2))
			)
			OR EXISTS (SELECT 1 FROM mufatish_kelas mk JOIN bagian b2 ON b2.kelas_id = mk.kelas_id AND b2.tingkatan_id = mk.tingkatan_id WHERE b2.id = s.bagian_id AND (mk.user_id = $2 OR mk.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $2)))
		) `
		args = append(args, userID)
	}

	query := baseQuery + ` ORDER BY s.nama ASC`
	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Santri
	for rows.Next() {
		s, err := scanSantriFull(rows, true)
		if err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

func GetArsipSantri(ctx context.Context, userRoles []string, userID int, filter SantriArsipFilter) ([]Santri, error) {

	baseQuery := `SELECT ` + santriSelectCols + `
			  FROM santri s WHERE 1=1`
	args := []interface{}{}

	isGlobal := false
	for _, r := range userRoles {
		if r == "pimpinan" || r == "admin" || r == "tim_rapot" || r == "keamanan" {
			isGlobal = true
			break
		}
	}

	if !isGlobal {
		var conditions []string
		for _, r := range userRoles {
			switch r {
			case "mufatish":
				conditions = append(conditions, `EXISTS (SELECT 1 FROM bagian b JOIN mufatish_kelas mk ON b.kelas_id = mk.kelas_id AND b.tingkatan_id = mk.tingkatan_id WHERE b.id = COALESCE(s.bagian_id, s.last_bagian_id) AND (mk.user_id = $1 OR mk.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $1)))`)
			case "mustahiq":
				conditions = append(conditions, `EXISTS (SELECT 1 FROM bagian b_mus JOIN mustahiq_bagian mb ON mb.bagian_id = b_mus.id WHERE b_mus.id = COALESCE(s.bagian_id, s.last_bagian_id) AND (mb.user_id = $1 OR mb.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $1)))`)
			}
		}

		if len(conditions) > 0 {
			baseQuery += ` AND (` + strings.Join(conditions, " OR ") + `) `
			args = append(args, userID)
		} else {
			// Without a matching role, return nothing
			baseQuery += ` AND 1 = 0 `
		}
	}

	if filter.Status != "" {
		baseQuery += " AND s.status = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.Status)
	} else {
		// By default show all non-active
		baseQuery += " AND s.status != 'aktif'"
	}

	if filter.BagianID > 0 {
		baseQuery += " AND COALESCE(s.bagian_id, s.last_bagian_id) = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.BagianID)
	} else {
		if filter.KelasID > 0 {
			baseQuery += " AND EXISTS (SELECT 1 FROM bagian b WHERE b.id = COALESCE(s.bagian_id, s.last_bagian_id) AND b.kelas_id = $" + strconv.Itoa(len(args)+1) + ")"
			args = append(args, filter.KelasID)
		}
		if filter.TingkatanID > 0 {
			baseQuery += " AND EXISTS (SELECT 1 FROM bagian b WHERE b.id = COALESCE(s.bagian_id, s.last_bagian_id) AND b.tingkatan_id = $" + strconv.Itoa(len(args)+1) + ")"
			args = append(args, filter.TingkatanID)
		}
	}

	if filter.TahunAjaran != "" {
		baseQuery += " AND COALESCE(s.last_tahun_ajaran, s.tahun_keluar) = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.TahunAjaran)
	}

	baseQuery += " ORDER BY s.nama ASC"

	rows, err := config.DB.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Santri
	for rows.Next() {
		s, err := scanSantriFull(rows, false)
		if err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

func GetSantriByID(ctx context.Context, id string, userRoles []string, userID int) (Santri, error) {
	baseQuery := `SELECT ` + santriSelectCols + `,
		 t.nama, b.nama_bagian, k.nama
		 FROM santri s
		 LEFT JOIN bagian b ON s.bagian_id = b.id
		 LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		 LEFT JOIN kelas k ON b.kelas_id = k.id
		 WHERE s.id = $1`

	args := []interface{}{id}

	// Detail santri bersifat read-only dan konsisten dengan global search yang
	// bisa dilakukan oleh siapa pun. Pengecualian hanya untuk wali_santri yang
	// harus dibatasi strictly ke anak mereka.
	isWaliSantriOnly := true
	for _, r := range userRoles {
		if r != "wali_santri" {
			isWaliSantriOnly = false
			break
		}
	}

	if isWaliSantriOnly {
		baseQuery += ` AND EXISTS (SELECT 1 FROM wali_santri_link wl WHERE wl.santri_id = s.id AND wl.user_id = $2)`
		args = append(args, userID)
	}

	row := config.DB.QueryRow(ctx, baseQuery, args...)
	return scanSantriFull(row, true)
}

func CreateSantri(ctx context.Context, s Santri, bagianAwalID int) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var santriID int
	var bagianIDPtr *int
	if bagianAwalID > 0 {
		bagianIDPtr = &bagianAwalID
	}

	err = tx.QueryRow(ctx,
		`INSERT INTO santri (nik, stambuk, nisn, nama, nama_wali, ttl_tempat, ttl_tanggal, alamat, no_hp_wali, kamar, bagian_id, status,
			provinsi_kode, provinsi_nama, kabupaten_kode, kabupaten_nama, kecamatan_kode, kecamatan_nama, desa, tahun_masuk)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'aktif', $12, $13, $14, $15, $16, $17, $18, EXTRACT(YEAR FROM CURRENT_DATE)::TEXT) RETURNING id`,
		s.NIK, s.Stambuk, s.NISN, s.Nama, s.NamaWali, s.TTLTempat, s.TTLTanggal, s.Alamat, s.NoHPWali, s.Kamar, bagianIDPtr,
		s.ProvinsiKode, s.ProvinsiNama, s.KabupatenKode, s.KabupatenNama, s.KecamatanKode, s.KecamatanNama, s.Desa).Scan(&santriID)

	if err != nil {
		return err
	}

	if bagianAwalID > 0 {
		// Otomatis assign riwayat_bagian
		_, err = tx.Exec(ctx,
			`INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai) VALUES ($1, $2, CURRENT_DATE)`,
			santriID, bagianAwalID)

		if err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if bagianAwalID > 0 {
		var tingkatanID, kelasID int
		if err := config.DB.QueryRow(ctx, `SELECT tingkatan_id, kelas_id FROM bagian WHERE id = $1`, bagianAwalID).Scan(&tingkatanID, &kelasID); err == nil && tingkatanID > 0 && kelasID > 0 {
			// Matikan fitur stambuk auto: jangan override stambuk dengan NULL dan jangan panggil AssignStambukTingkatan
			// Susun ulang nomor urut stambuk (bukan Stambuk) di kelas
			_, _ = SusunUlangStambuk(ctx, tingkatanID, kelasID)
		}
	}

	return nil
}

func UpdateSantri(ctx context.Context, id int, s Santri) error {
	_, err := config.DB.Exec(ctx,
		`UPDATE santri 
		 SET nik = $1, stambuk = $2, nisn = $3, nama = $4, nama_wali = $5, 
		     ttl_tempat = $6, ttl_tanggal = $7, alamat = $8, no_hp_wali = $9, kamar = $10,
		     provinsi_kode = $11, provinsi_nama = $12, kabupaten_kode = $13, kabupaten_nama = $14,
		     kecamatan_kode = $15, kecamatan_nama = $16, desa = $17
		 WHERE id = $18`,
		s.NIK, s.Stambuk, s.NISN, s.Nama, s.NamaWali,
		s.TTLTempat, s.TTLTanggal, s.Alamat, s.NoHPWali, s.Kamar,
		s.ProvinsiKode, s.ProvinsiNama, s.KabupatenKode, s.KabupatenNama,
		s.KecamatanKode, s.KecamatanNama, s.Desa, id)
	return err
}

func DeleteSantri(ctx context.Context, id int) error {
	tag, err := config.DB.Exec(ctx, "DELETE FROM santri WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("santri dengan ID %d tidak ditemukan", id)
	}
	return nil
}

// ImportRowError merepresentasikan kegagalan satu baris saat impor Excel.
type ImportRowError struct {
	Baris int    `json:"baris"`
	Nama  string `json:"nama"`
	Pesan string `json:"pesan"`
}

// ImportResult adalah ringkasan hasil impor.
type ImportResult struct {
	Sukses int              `json:"sukses"`
	Gagal  int              `json:"gagal"`
	Errors []ImportRowError `json:"errors"`
}

// ImportSantriBatch memasukkan banyak santri dalam satu transaksi. Jika ada baris
// yang gagal validasi/insert, seluruh transaksi dibatalkan dan errornya dilaporkan
// agar pengguna memperbaiki file lalu mengunggah ulang.
func ImportSantriBatch(ctx context.Context, list []Santri, rowNumbers []int) (ImportResult, error) {
	res := ImportResult{}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return res, err
	}
	defer tx.Rollback(ctx)

	for i, s := range list {
		baris := i + 2
		if i < len(rowNumbers) {
			baris = rowNumbers[i]
		}

		_, err := tx.Exec(ctx,
			`INSERT INTO santri (nik, stambuk, nisn, nama, nama_wali, ttl_tempat, ttl_tanggal, alamat, no_hp_wali, kamar, status,
				provinsi_kode, provinsi_nama, kabupaten_kode, kabupaten_nama, kecamatan_kode, kecamatan_nama, desa, tahun_masuk)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'aktif', $12, $13, $14, $15, $16, $17, $18, EXTRACT(YEAR FROM CURRENT_DATE)::TEXT)`,
			s.NIK, s.Stambuk, s.NISN, s.Nama, s.NamaWali, s.TTLTempat, s.TTLTanggal, s.Alamat, s.NoHPWali, s.Kamar,
			s.ProvinsiKode, s.ProvinsiNama, s.KabupatenKode, s.KabupatenNama, s.KecamatanKode, s.KecamatanNama, s.Desa)

		if err != nil {
			res.Gagal++
			res.Errors = append(res.Errors, ImportRowError{Baris: baris, Nama: s.Nama, Pesan: humanizeDBError(err)})
			continue
		}
		res.Sukses++
	}

	if res.Gagal > 0 {
		// Batalkan semua agar tidak ada data setengah masuk.
		return res, fmt.Errorf("impor dibatalkan: %d baris gagal", res.Gagal)
	}

	if err := tx.Commit(ctx); err != nil {
		return res, err
	}
	return res, nil
}

// humanizeDBError mengubah pesan error DB umum menjadi lebih ramah.
func humanizeDBError(err error) string {
	msg := err.Error()
	switch {
	case contains(msg, "santri_nik_key"):
		return "NIK sudah terdaftar"
	case contains(msg, "santri_stambuk_key"):
		return "Stambuk sudah terdaftar"
	case contains(msg, "duplicate key"):
		return "Data duplikat (NIK/stambuk sudah ada)"
	default:
		return msg
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && indexOf(s, sub) >= 0
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func AssignSantriToBagian(ctx context.Context, santriIDs []int, bagianID int) error {
	if len(santriIDs) == 0 {
		return nil
	}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// We'll update each santri
	for _, sID := range santriIDs {
		// Close previous riwayat_bagian
		_, err = tx.Exec(ctx, "UPDATE riwayat_bagian SET tanggal_selesai = CURRENT_DATE WHERE santri_id = $1 AND tanggal_selesai IS NULL", sID)
		if err != nil {
			return err
		}

		// Update santri.bagian_id
		if bagianID > 0 {
			_, err = tx.Exec(ctx, "UPDATE santri SET bagian_id = $1 WHERE id = $2", bagianID, sID)
		} else {
			_, err = tx.Exec(ctx, "UPDATE santri SET bagian_id = NULL WHERE id = $1", sID)
		}
		if err != nil {
			return err
		}

		// Create new riwayat_bagian
		if bagianID > 0 {
			_, err = tx.Exec(ctx, "INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai) VALUES ($1, $2, CURRENT_DATE)", sID, bagianID)
			if err != nil {
				return err
			}
		}
	}

	var tingkatanID, kelasID int
	if bagianID > 0 {
		err = tx.QueryRow(ctx, `SELECT tingkatan_id, kelas_id FROM bagian WHERE id = $1`, bagianID).Scan(&tingkatanID, &kelasID)
		if err == nil && tingkatanID > 0 && kelasID > 0 {
			// Matikan fitur stambuk auto: jangan override stambuk ketika pindah tingkatan
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// 5. Eksekusi Post-Commit (Susun ulang urut stambuk)
	if bagianID > 0 && tingkatanID > 0 && kelasID > 0 {
		_, _ = SusunUlangStambuk(ctx, tingkatanID, kelasID)
	}

	return nil
}

func GetSantriFotoURL(ctx context.Context, santriID string) (string, error) {
	var url *string
	err := config.DB.QueryRow(ctx, "SELECT foto_url FROM santri WHERE id = $1", santriID).Scan(&url)
	if err != nil {
		return "", err
	}
	if url != nil {
		return *url, nil
	}
	return "", nil
}

func UpdateFotoSantri(ctx context.Context, santriID string, url string) error {
	_, err := config.DB.Exec(ctx, "UPDATE santri SET foto_url = $1, updated_at = NOW() WHERE id = $2", url, santriID)
	return err
}
