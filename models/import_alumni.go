package models

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/mubtadiaat/app/config"
	"github.com/xuri/excelize/v2"
)

// AlumniImportResult berisi ringkasan hasil import alumni.
type AlumniImportResult struct {
	Total    int      `json:"total"`
	Inserted int      `json:"inserted"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
}

// ImportAlumniFromExcel membaca file Excel format:
// NAMA | Stambuk | NISN | TTL | WALI | ALAMAT | NO HP WS | KHIDMAH | TEMPAT KHIDMAH | PENGAMBILAN IJAZAH | KETERANGAN | TAHUN MASUK | TAHUN KELUAR
// Insert ke tabel santri (status=lulus) + alumni.
func ImportAlumniFromExcel(ctx context.Context, reader io.Reader) (*AlumniImportResult, error) {
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

	result := &AlumniImportResult{}

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
		stambuk := get(1)
		nisn := get(2)
		ttl := get(3)
		wali := get(4)
		alamat := get(5)
		noHP := get(6)
		khidmahRaw := strings.ToLower(get(7))
		tempatKhidmah := get(8)
		ijazahRaw := strings.ToLower(get(9))
		keterangan := get(10)
		tahunMasuk := get(11)
		tahunKeluar := get(12)
		kamar := get(13)

		// Skip empty rows
		if nama == "" && stambuk == "" {
			result.Total--
			continue
		}

		if nama == "" || stambuk == "" {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("Baris %d: Nama dan Stambuk wajib diisi", rowNum+1))
			continue
		}

		// Parse khidmah
		khidmah := "belum"
		if strings.Contains(khidmahRaw, "tidak") {
			khidmah = "tidak_khidmah"
		} else if strings.Contains(khidmahRaw, "khidmah") {
			khidmah = "selesai"
		}

		// Parse status ijazah
		statusIjazah := "belum"
		if strings.Contains(ijazahRaw, "sudah") {
			statusIjazah = "sudah"
		} else if strings.Contains(ijazahRaw, "tidak") {
			statusIjazah = "tidak"
		}

		// Generate NIK (format Excel alumni tidak punya NIK terpisah)
		nik := fmt.Sprintf("ALM_%s_%d", stambuk, time.Now().UnixMilli()%100000+int64(rowNum))

		// Cek duplikat Stambuk
		var exists bool
		_ = config.DB.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM santri WHERE stambuk = $1)`, stambuk).Scan(&exists)
		if exists {
			// Update existing santri instead of skip
			var santriID int
			err := config.DB.QueryRow(ctx,
				`UPDATE santri SET
				   nisn = COALESCE($1, nisn),
				   nama_wali = COALESCE($2, nama_wali),
				   alamat = COALESCE($3, alamat),
				   no_hp_wali = COALESCE($4, no_hp_wali),
				   tahun_masuk = COALESCE($5, tahun_masuk),
				   tahun_keluar = COALESCE($6, tahun_keluar),
				   kamar = COALESCE($7, kamar),
				   status = 'lulus'
				 WHERE stambuk = $8 RETURNING id`,
				nilIfEmpty(nisn), nilIfEmpty(wali), nilIfEmpty(alamat), nilIfEmpty(noHP),
				nilIfEmpty(tahunMasuk), nilIfEmpty(tahunKeluar), nilIfEmpty(kamar), stambuk).Scan(&santriID)
			if err != nil {
				result.Skipped++
				result.Errors = append(result.Errors, fmt.Sprintf("Baris %d: update gagal: %v", rowNum+1, err))
				continue
			}
			// Upsert alumni
			_, _ = config.DB.Exec(ctx,
				`INSERT INTO alumni (santri_id, tahun_lulus, khidmah, status_ijazah, keterangan)
				 VALUES ($1, $2, $3, $4, $5)
				 ON CONFLICT (santri_id) DO UPDATE SET
				   khidmah = EXCLUDED.khidmah, status_ijazah = EXCLUDED.status_ijazah,
				   keterangan = EXCLUDED.keterangan, updated_at = CURRENT_TIMESTAMP`,
				santriID, nilIfEmpty(tahunKeluar), khidmah, statusIjazah, nilIfEmpty(keterangan))
			if tempatKhidmah != "" {
				_, _ = config.DB.Exec(ctx, `UPDATE santri SET khidmah_tempat = $1 WHERE id = $2`, tempatKhidmah, santriID)
			}
			result.Inserted++
			continue
		}

		// Insert santri baru
		var santriID int
		err = config.DB.QueryRow(ctx,
			`INSERT INTO santri (nik, stambuk, nisn, nama, nama_wali, ttl_tempat, alamat, no_hp_wali,
			   status, khidmah_tempat, tahun_masuk, tahun_keluar, kamar)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'lulus', $9, $10, $11, $12) RETURNING id`,
			nik, stambuk, nilIfEmpty(nisn), nama, nilIfEmpty(wali), nilIfEmpty(ttl), nilIfEmpty(alamat), nilIfEmpty(noHP),
			nilIfEmpty(tempatKhidmah), nilIfEmpty(tahunMasuk), nilIfEmpty(tahunKeluar), nilIfEmpty(kamar)).Scan(&santriID)
		if err != nil {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("Baris %d (%s): %v", rowNum+1, nama, err))
			continue
		}

		// Insert alumni record
		_, err = config.DB.Exec(ctx,
			`INSERT INTO alumni (santri_id, tahun_lulus, khidmah, status_ijazah, keterangan)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (santri_id) DO UPDATE SET
			   khidmah = EXCLUDED.khidmah, status_ijazah = EXCLUDED.status_ijazah,
			   keterangan = EXCLUDED.keterangan, updated_at = CURRENT_TIMESTAMP`,
			santriID, nilIfEmpty(tahunKeluar), khidmah, statusIjazah, nilIfEmpty(keterangan))
		if err != nil {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("Baris %d (%s) alumni: %v", rowNum+1, nama, err))
			continue
		}

		result.Inserted++
	}

	return result, nil
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
