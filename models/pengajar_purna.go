package models

import (
	"context"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/mubtadiaat/app/config"
	"github.com/xuri/excelize/v2"
)

// PengajarPurna adalah entri arsip pengajar lama (mustahiq/munawwib) yang sudah
// tidak aktif. Disimpan terpisah dari tabel `pengajar` (lihat migrasi 044).
type PengajarPurna struct {
	ID            int       `json:"id"`
	Nama          string    `json:"nama"`
	Status        *string   `json:"status"` // mustahiq | munawwib
	TTL           *string   `json:"ttl"`
	NamaWali      *string   `json:"nama_wali"`
	NoHP          *string   `json:"no_hp"`
	Alamat        *string   `json:"alamat"`
	TahunMengajar *string   `json:"tahun_mengajar"` // tahun mulai (= tahun masuk)
	TahunKeluar   *string   `json:"tahun_keluar"`
	ProvinsiKode  *string   `json:"provinsi_kode"`
	ProvinsiNama  *string   `json:"provinsi_nama"`
	KabupatenKode *string   `json:"kabupaten_kode"`
	KabupatenNama *string   `json:"kabupaten_nama"`
	AsalDaerah    string    `json:"asal_daerah"` // turunan (kabupaten, provinsi) untuk tampilan
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
}

// PengajarPurnaFilter berisi filter opsional untuk daftar pengajar purna.
type PengajarPurnaFilter struct {
	Status        string
	ProvinsiKode  string
	KabupatenKode string
	TahunMasuk    string // dicocokkan ke kolom tahun_mengajar
	TahunKeluar   string
}

const pengajarPurnaCols = `id, nama, status, ttl, nama_wali, no_hp, alamat, tahun_mengajar, tahun_keluar,
	provinsi_kode, provinsi_nama, kabupaten_kode, kabupaten_nama, is_active, created_at`

func scanPengajarPurna(rows interface {
	Scan(...interface{}) error
}) (PengajarPurna, error) {
	var p PengajarPurna
	err := rows.Scan(&p.ID, &p.Nama, &p.Status, &p.TTL, &p.NamaWali, &p.NoHP, &p.Alamat,
		&p.TahunMengajar, &p.TahunKeluar, &p.ProvinsiKode, &p.ProvinsiNama,
		&p.KabupatenKode, &p.KabupatenNama, &p.IsActive, &p.CreatedAt)
	if err != nil {
		return p, err
	}
	p.AsalDaerah = buildAsalDaerah(p.KabupatenNama, p.ProvinsiNama, p.Alamat)
	return p, nil
}

// GetAllPengajarPurna mengembalikan daftar pengajar purna aktif dengan filter dinamis.
func GetAllPengajarPurna(ctx context.Context, filter PengajarPurnaFilter) ([]PengajarPurna, error) {
	query := `SELECT ` + pengajarPurnaCols + ` FROM pengajar_purna WHERE is_active = true`
	args := []interface{}{}

	if filter.Status != "" {
		query += " AND status = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.Status)
	}
	if filter.ProvinsiKode != "" {
		query += " AND provinsi_kode = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.ProvinsiKode)
	}
	if filter.KabupatenKode != "" {
		query += " AND kabupaten_kode = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.KabupatenKode)
	}
	if filter.TahunMasuk != "" {
		query += " AND tahun_mengajar = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.TahunMasuk)
	}
	if filter.TahunKeluar != "" {
		query += " AND tahun_keluar = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.TahunKeluar)
	}
	query += " ORDER BY nama ASC"

	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := []PengajarPurna{}
	for rows.Next() {
		p, err := scanPengajarPurna(rows)
		if err != nil {
			return nil, err
		}
		res = append(res, p)
	}
	return res, nil
}

// GetPengajarPurnaByID mengembalikan satu entri pengajar purna aktif.
func GetPengajarPurnaByID(ctx context.Context, id int) (*PengajarPurna, error) {
	row := config.DB.QueryRow(ctx,
		`SELECT `+pengajarPurnaCols+` FROM pengajar_purna WHERE id = $1 AND is_active = true`, id)
	p, err := scanPengajarPurna(row)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// CreatePengajarPurna menambahkan satu entri pengajar purna.
func CreatePengajarPurna(ctx context.Context, p PengajarPurna) error {
	_, err := config.DB.Exec(ctx,
		`INSERT INTO pengajar_purna
		   (nama, status, ttl, nama_wali, no_hp, alamat, tahun_mengajar, tahun_keluar,
		    provinsi_kode, provinsi_nama, kabupaten_kode, kabupaten_nama, is_active)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)`,
		p.Nama, p.Status, p.TTL, p.NamaWali, p.NoHP, p.Alamat, p.TahunMengajar, p.TahunKeluar,
		p.ProvinsiKode, p.ProvinsiNama, p.KabupatenKode, p.KabupatenNama)
	return err
}

// UpdatePengajarPurna memperbarui satu entri pengajar purna.
func UpdatePengajarPurna(ctx context.Context, id int, p PengajarPurna) error {
	_, err := config.DB.Exec(ctx,
		`UPDATE pengajar_purna SET
		   nama = $1, status = $2, ttl = $3, nama_wali = $4, no_hp = $5, alamat = $6,
		   tahun_mengajar = $7, tahun_keluar = $8, provinsi_kode = $9, provinsi_nama = $10,
		   kabupaten_kode = $11, kabupaten_nama = $12, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $13`,
		p.Nama, p.Status, p.TTL, p.NamaWali, p.NoHP, p.Alamat, p.TahunMengajar, p.TahunKeluar,
		p.ProvinsiKode, p.ProvinsiNama, p.KabupatenKode, p.KabupatenNama, id)
	return err
}

// DeletePengajarPurna melakukan soft delete (is_active = false).
func DeletePengajarPurna(ctx context.Context, id int) error {
	_, err := config.DB.Exec(ctx, `UPDATE pengajar_purna SET is_active = false WHERE id = $1`, id)
	return err
}

// PindahPurnaResult berisi hasil memindahkan pengajar aktif ke arsip purna.
type PindahPurnaResult struct {
	Moved        int      `json:"moved"`         // jumlah pengajar yang berhasil dipindah
	Skipped      int      `json:"skipped"`       // dilewati (tidak ditemukan / sudah nonaktif)
	Errors       []string `json:"errors"`        // detail per pengajar yang gagal
	PurnaIDs     []int    `json:"purna_ids"`     // ID baris baru di pengajar_purna
}

// PindahPengajarKePurna memindahkan pengajar aktif menjadi arsip pengajar purna.
//
// Alur (satu transaksi atomik per pengajar):
//  1. INSERT baris baru ke pengajar_purna — field disalin dari pengajar
//     (nama, status auto-copy, ttl, nama_wali, no_hp, alamat, tahun_mengajar)
//     plus tahun_keluar / wilayah dari permintaan.
//  2. UPDATE pengajar SET is_active = false (baris ASLI dipertahankan —
//     11 tabel FK historis: absensi, penilaian, jadwal, users, dll).
//  3. UPDATE users SET is_active = false WHERE pengajar_id = ... (akun login dimatikan).
//  4. DELETE FROM sessions WHERE user_id ... (sesi aktif diputus).
func PindahPengajarKePurna(ctx context.Context, ids []int, tahunKeluar, provKode, provNama, kabKode, kabNama string) (*PindahPurnaResult, error) {
	res := &PindahPurnaResult{Errors: []string{}}

	for _, id := range ids {
		var (
			nama, status          string
			ttl, namaWali, noHP   *string
			alamat, tahunMengajar *string
			ada                   bool
		)
		err := config.DB.QueryRow(ctx,
			`SELECT nama, COALESCE(status,''), ttl, nama_wali, no_hp, alamat, tahun_mengajar, is_active
			   FROM pengajar WHERE id = $1`, id).
			Scan(&nama, &status, &ttl, &namaWali, &noHP, &alamat, &tahunMengajar, &ada)
		if err != nil {
			res.Skipped++
			res.Errors = append(res.Errors, fmt.Sprintf("ID %d: tidak ditemukan", id))
			continue
		}
		if !ada {
			res.Skipped++
			res.Errors = append(res.Errors, fmt.Sprintf("ID %d (%s): sudah nonaktif", id, nama))
			continue
		}

		tx, err := config.DB.Begin(ctx)
		if err != nil {
			res.Skipped++
			res.Errors = append(res.Errors, fmt.Sprintf("ID %d (%s): %v", id, nama, err))
			continue
		}
		fail := func(e error) {
			tx.Rollback(ctx)
			res.Skipped++
			res.Errors = append(res.Errors, fmt.Sprintf("ID %d (%s): %v", id, nama, e))
		}

		// 1. INSERT ke purna — status auto-copy dari status terakhir pengajar (keputusan klien 2026-09-12: opsi A)
		var purnaID int
		if err := tx.QueryRow(ctx,
			`INSERT INTO pengajar_purna
			   (nama, status, ttl, nama_wali, no_hp, alamat, tahun_mengajar, tahun_keluar,
			    provinsi_kode, provinsi_nama, kabupaten_kode, kabupaten_nama, is_active)
			 VALUES ($1, NULLIF($2,''), $3, $4, $5, $6, $7, NULLIF($8,''),
			         NULLIF($9,''), NULLIF($10,''), NULLIF($11,''), NULLIF($12,''), true)
			 RETURNING id`,
			nama, status, ttl, namaWali, noHP, alamat, tahunMengajar, tahunKeluar,
			provKode, provNama, kabKode, kabNama).Scan(&purnaID); err != nil {
			fail(fmt.Errorf("insert purna: %w", err))
			continue
		}

		// 2. Nonaktifkan baris pengajar asli (soft — riwayat historis FK tetap utuh).
		if _, err := tx.Exec(ctx, `UPDATE pengajar SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, id); err != nil {
			fail(fmt.Errorf("nonaktif pengajar: %w", err))
			continue
		}

		// 3. Matikan akun login pengguna terkait + putus semua sesi aktif (keputusan klien: matikan).
		if _, err := tx.Exec(ctx, `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE pengajar_id = $1`, id); err != nil {
			fail(fmt.Errorf("nonaktif user: %w", err))
			continue
		}
		if _, err := tx.Exec(ctx, `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE pengajar_id = $1)`, id); err != nil {
			fail(fmt.Errorf("putus sesi: %w", err))
			continue
		}

		if err := tx.Commit(ctx); err != nil {
			fail(fmt.Errorf("commit: %w", err))
			continue
		}
		res.Moved++
		res.PurnaIDs = append(res.PurnaIDs, purnaID)
	}

	return res, nil
}

// PengajarPurnaImportResult berisi ringkasan hasil import.
type PengajarPurnaImportResult struct {
	Total    int      `json:"total"`
	Inserted int      `json:"inserted"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
}

// ImportPengajarPurnaFromExcel membaca file Excel dengan format kolom:
// Nama | Status | TTL | Nama Wali | No HP | Alamat | Provinsi | Kabupaten | Tahun Mengajar | Tahun Keluar
// Nama provinsi/kabupaten dipetakan ke kode wilayah (jika cocok); jika tidak
// cocok, kolom wilayah dikosongkan tetapi baris tetap disimpan.
func ImportPengajarPurnaFromExcel(ctx context.Context, reader io.Reader) (*PengajarPurnaImportResult, error) {
	f, err := excelize.OpenReader(reader)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca file Excel: %w", err)
	}
	defer f.Close()

	sheetName := f.GetSheetName(0)
	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca sheet: %w", err)
	}
	if len(rows) < 2 {
		return nil, fmt.Errorf("file kosong atau hanya berisi header")
	}

	result := &PengajarPurnaImportResult{}

	for rowNum := 1; rowNum < len(rows); rowNum++ {
		row := rows[rowNum]
		result.Total++

		get := func(i int) string {
			if i < len(row) {
				return strings.TrimSpace(row[i])
			}
			return ""
		}

		nama := get(0)
		statusRaw := strings.ToLower(get(1))
		ttl := get(2)
		wali := get(3)
		noHP := get(4)
		alamat := get(5)
		provNama := get(6)
		kabNama := get(7)
		tahunMengajar := get(8)
		tahunKeluar := get(9)

		// Lewati baris kosong
		if nama == "" {
			result.Total--
			continue
		}

		// Normalisasi status ke nilai kanonik
		status := ""
		if strings.Contains(statusRaw, "munawwib") {
			status = "munawwib"
		} else if strings.Contains(statusRaw, "mustahiq") {
			status = "mustahiq"
		}

		// Petakan nama wilayah -> kode (best-effort; abaikan bila tak cocok)
		var provKode, provNamaOut, kabKode, kabNamaOut *string
		if provNama != "" {
			if wprov, e := FindProvinsiByNama(ctx, provNama); e == nil {
				pk, pn := wprov.Kode, wprov.Nama
				provKode, provNamaOut = &pk, &pn
				if kabNama != "" {
					if wkab, e2 := FindKabupatenByNama(ctx, wprov.Kode, kabNama); e2 == nil {
						kk, kn := wkab.Kode, wkab.Nama
						kabKode, kabNamaOut = &kk, &kn
					}
				}
			}
		}

		p := PengajarPurna{
			Nama:          nama,
			Status:        nilIfEmpty(status),
			TTL:           nilIfEmpty(ttl),
			NamaWali:      nilIfEmpty(wali),
			NoHP:          nilIfEmpty(noHP),
			Alamat:        nilIfEmpty(alamat),
			TahunMengajar: nilIfEmpty(tahunMengajar),
			TahunKeluar:   nilIfEmpty(tahunKeluar),
			ProvinsiKode:  provKode,
			ProvinsiNama:  provNamaOut,
			KabupatenKode: kabKode,
			KabupatenNama: kabNamaOut,
		}

		if err := CreatePengajarPurna(ctx, p); err != nil {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("Baris %d (%s): %v", rowNum+1, nama, err))
			continue
		}
		result.Inserted++
	}

	return result, nil
}
