package models

import (
	"context"

	"github.com/mubtadiaat/app/config"
)

// === SANTRI ===

// AbsensiManualBulanan satu baris = 1 santri × 1 bulan Hijriyah.
type AbsensiManualBulanan struct {
	ID          int    `json:"id,omitempty"`
	SantriID    int    `json:"santri_id"`
	TahunHijri  int    `json:"tahun_hijri"`
	BulanHijri  int    `json:"bulan_hijri"` // 1-12
	TahunAjaran string `json:"tahun_ajaran"`
	TotalSakit  int    `json:"total_sakit"`
	TotalIzin   int    `json:"total_izin"`
	TotalAlpha  int    `json:"total_alpha"`
	TotalHadir  int    `json:"total_hadir"`
	Semester    int    `json:"semester"` // 1/2 dari mapping bulan Hijri; 0 = belum
}

// GetAbsensiManualBulanan mengambil data absensi manual untuk satu bagian pada
// tahun Hijriyah tertentu. Mengembalikan slice per santri per bulan.
func GetAbsensiManualBulanan(ctx context.Context, bagianID, tahunHijri int) ([]AbsensiManualBulanan, error) {
	rows, err := config.DB.Query(ctx, `
		SELECT am.id, am.santri_id, am.tahun_hijri, am.bulan_hijri, am.tahun_ajaran,
		       am.total_sakit, am.total_izin, am.total_alpha, am.total_hadir
		FROM absensi_manual_bulanan am
		JOIN santri s ON am.santri_id = s.id
		WHERE s.bagian_id = $1 AND am.tahun_hijri = $2
		ORDER BY s.nama, am.bulan_hijri`, bagianID, tahunHijri)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []AbsensiManualBulanan
	for rows.Next() {
		var r AbsensiManualBulanan
		if err := rows.Scan(&r.ID, &r.SantriID, &r.TahunHijri, &r.BulanHijri, &r.TahunAjaran,
			&r.TotalSakit, &r.TotalIzin, &r.TotalAlpha, &r.TotalHadir); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, nil
}

// SaveAbsensiManualBulanan menyimpan batch data absensi manual bulanan.
// Menggunakan UPSERT: jika sudah ada record untuk santri+tahun+bulan, update.
// Jika semua total = 0, hapus record (kembali ke default hadir).
func SaveAbsensiManualBulanan(ctx context.Context, entries []AbsensiManualBulanan) (saved, deleted int, err error) {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback(ctx)

	for _, e := range entries {
		if e.TotalSakit == 0 && e.TotalIzin == 0 && e.TotalAlpha == 0 && e.TotalHadir == 0 {
			// Hapus record (santri full hadir bulan ini).
			tag, err2 := tx.Exec(ctx,
				`DELETE FROM absensi_manual_bulanan WHERE santri_id=$1 AND tahun_hijri=$2 AND bulan_hijri=$3`,
				e.SantriID, e.TahunHijri, e.BulanHijri)
			if err2 != nil {
				return 0, 0, err2
			}
			if tag.RowsAffected() > 0 {
				deleted++
			}
			continue
		}

		// Resolve semester dari mapping bulan Hijri absolut (0 jika belum ada).
		sem := SemesterBulanHijri(ctx, e.TahunHijri, e.BulanHijri)
		var semVal interface{}
		if sem > 0 {
			semVal = sem
		}

		_, err2 := tx.Exec(ctx, `
			INSERT INTO absensi_manual_bulanan (santri_id, tahun_hijri, bulan_hijri, tahun_ajaran, total_sakit, total_izin, total_alpha, total_hadir, semester)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (santri_id, tahun_hijri, bulan_hijri)
			DO UPDATE SET total_sakit = EXCLUDED.total_sakit,
			             total_izin = EXCLUDED.total_izin,
			             total_alpha = EXCLUDED.total_alpha,
			             total_hadir = EXCLUDED.total_hadir,
			             tahun_ajaran = EXCLUDED.tahun_ajaran,
			             semester = EXCLUDED.semester,
			             updated_at = CURRENT_TIMESTAMP`,
			e.SantriID, e.TahunHijri, e.BulanHijri, e.TahunAjaran, e.TotalSakit, e.TotalIzin, e.TotalAlpha, e.TotalHadir, semVal)
		if err2 != nil {
			return 0, 0, err2
		}
		saved++
	}

	err = tx.Commit(ctx)
	return
}

// === PENGAJAR ===

// AbsensiManualPengajarBulanan satu baris = 1 pengajar × 1 bulan Hijriyah.
type AbsensiManualPengajarBulanan struct {
	ID          int    `json:"id,omitempty"`
	PengajarID  int    `json:"pengajar_id"`
	TahunHijri  int    `json:"tahun_hijri"`
	BulanHijri  int    `json:"bulan_hijri"`
	TahunAjaran string `json:"tahun_ajaran"`
	TotalSakit  int    `json:"total_sakit"`
	TotalIzin   int    `json:"total_izin"`
	TotalAlpha  int    `json:"total_alpha"`
	TotalHadir  int    `json:"total_hadir"`
	Semester    int    `json:"semester"` // 1/2 dari mapping bulan Hijri; 0 = belum
}

// GetAbsensiManualPengajarBulanan mengambil data untuk tahun Hijriyah tertentu.
func GetAbsensiManualPengajarBulanan(ctx context.Context, tahunHijri int, bagianID int, tingkatanID int, kelasID int) ([]AbsensiManualPengajarBulanan, error) {
	query := `
		SELECT am.id, am.pengajar_id, am.tahun_hijri, am.bulan_hijri, am.tahun_ajaran,
		       am.total_sakit, am.total_izin, am.total_alpha, am.total_hadir
		FROM absensi_manual_pengajar_bulanan am
		JOIN pengajar p ON am.pengajar_id = p.id
		WHERE am.tahun_hijri = $1`
	
	args := []interface{}{tahunHijri}
	
	if bagianID > 0 {
		args = append(args, bagianID)
		query += ` AND (EXISTS (SELECT 1 FROM jadwal_pelajaran jp WHERE jp.pengajar_id = p.id AND jp.bagian_id = $2)
		            OR EXISTS (SELECT 1 FROM pengajar_bagian pb WHERE pb.pengajar_id = p.id AND pb.bagian_id = $2))`
	} else if tingkatanID > 0 && kelasID > 0 {
		args = append(args, tingkatanID, kelasID)
		query += ` AND EXISTS (
			SELECT 1 FROM bagian b
			WHERE b.tingkatan_id = $2 AND b.kelas_id = $3
			AND (
				EXISTS (SELECT 1 FROM mustahiq_bagian mb WHERE mb.pengajar_id = p.id AND mb.bagian_id = b.id)
				OR EXISTS (SELECT 1 FROM pengajar_bagian pb WHERE pb.pengajar_id = p.id AND pb.bagian_id = b.id AND pb.peran = 'munawwib')
			)
		)`
	}
	
	query += ` ORDER BY p.nama, am.bulan_hijri`
	
	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []AbsensiManualPengajarBulanan
	for rows.Next() {
		var r AbsensiManualPengajarBulanan
		if err := rows.Scan(&r.ID, &r.PengajarID, &r.TahunHijri, &r.BulanHijri, &r.TahunAjaran,
			&r.TotalSakit, &r.TotalIzin, &r.TotalAlpha, &r.TotalHadir); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, nil
}

// SaveAbsensiManualPengajarBulanan menyimpan batch data pengajar.
func SaveAbsensiManualPengajarBulanan(ctx context.Context, entries []AbsensiManualPengajarBulanan) (saved, deleted int, err error) {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback(ctx)

	for _, e := range entries {
		if e.TotalSakit == 0 && e.TotalIzin == 0 && e.TotalAlpha == 0 && e.TotalHadir == 0 {
			// Hapus record (pengajar full hadir bulan ini).
			tag, err2 := tx.Exec(ctx,
				`DELETE FROM absensi_manual_pengajar_bulanan WHERE pengajar_id=$1 AND tahun_hijri=$2 AND bulan_hijri=$3`,
				e.PengajarID, e.TahunHijri, e.BulanHijri)
			if err2 != nil {
				return 0, 0, err2
			}
			if tag.RowsAffected() > 0 {
				deleted++
			}
			continue
		}

		// Resolve semester dari mapping bulan Hijri absolut (0 jika belum ada).
		sem := SemesterBulanHijri(ctx, e.TahunHijri, e.BulanHijri)
		var semVal interface{}
		if sem > 0 {
			semVal = sem
		}

		_, err2 := tx.Exec(ctx, `
			INSERT INTO absensi_manual_pengajar_bulanan (pengajar_id, tahun_hijri, bulan_hijri, tahun_ajaran, total_sakit, total_izin, total_alpha, total_hadir, semester)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (pengajar_id, tahun_hijri, bulan_hijri)
			DO UPDATE SET total_sakit = EXCLUDED.total_sakit,
			             total_izin = EXCLUDED.total_izin,
			             total_alpha = EXCLUDED.total_alpha,
			             total_hadir = EXCLUDED.total_hadir,
			             tahun_ajaran = EXCLUDED.tahun_ajaran,
			             semester = EXCLUDED.semester,
			             updated_at = CURRENT_TIMESTAMP`,
			e.PengajarID, e.TahunHijri, e.BulanHijri, e.TahunAjaran, e.TotalSakit, e.TotalIzin, e.TotalAlpha, e.TotalHadir, semVal)
		if err2 != nil {
			return 0, 0, err2
		}
		saved++
	}

	err = tx.Commit(ctx)
	return
}
