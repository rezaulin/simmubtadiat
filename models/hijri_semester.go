package models

import (
	"context"
	"fmt"

	"github.com/mubtadiaat/app/config"
)

// KalenderSemesterHijri = mulai & selesai satu semester dalam tanggal Hijriyah.
// Ekuivalen Masehi (MasehiMulai/Selesai) dihitung frontend (Intl islamic-umalqura)
// dan disimpan agar absensi sesi (input Masehi) bisa lookup semester.
type KalenderSemesterHijri struct {
	TahunAjaran       string `json:"tahun_ajaran"`
	Semester          int    `json:"semester"` // 1 atau 2
	MulaiTahunHijri   int    `json:"mulai_tahun_hijri"`
	MulaiBulanHijri   int    `json:"mulai_bulan_hijri"` // 1-12
	MulaiTanggal      int    `json:"mulai_tanggal"`     // 1-30
	SelesaiTahunHijri int    `json:"selesai_tahun_hijri"`
	SelesaiBulanHijri int    `json:"selesai_bulan_hijri"`
	SelesaiTanggal    int    `json:"selesai_tanggal"`
	MasehiMulai       string `json:"masehi_mulai,omitempty"`   // YYYY-MM-DD
	MasehiSelesai     string `json:"masehi_selesai,omitempty"` // YYYY-MM-DD
}

// hijriOrdinal mengubah tanggal Hijri ke angka monotonik untuk perbandingan urut.
func hijriOrdinal(tahun, bulan, tanggal int) int {
	return tahun*360 + bulan*30 + tanggal
}

// GetKalenderSemesterHijri mengambil kalender semester (1 & 2) suatu tahun ajaran.
func GetKalenderSemesterHijri(ctx context.Context, tahunAjaran string) ([]KalenderSemesterHijri, error) {
	rows, err := config.DB.Query(ctx, `
		SELECT tahun_ajaran, semester,
		       mulai_tahun_hijri, mulai_bulan_hijri, mulai_tanggal,
		       selesai_tahun_hijri, selesai_bulan_hijri, selesai_tanggal,
		       COALESCE(TO_CHAR(masehi_mulai, 'YYYY-MM-DD'), ''),
		       COALESCE(TO_CHAR(masehi_selesai, 'YYYY-MM-DD'), '')
		  FROM kalender_semester_hijri
		 WHERE tahun_ajaran = $1
		 ORDER BY semester`, tahunAjaran)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := []KalenderSemesterHijri{}
	for rows.Next() {
		var k KalenderSemesterHijri
		if err := rows.Scan(&k.TahunAjaran, &k.Semester,
			&k.MulaiTahunHijri, &k.MulaiBulanHijri, &k.MulaiTanggal,
			&k.SelesaiTahunHijri, &k.SelesaiBulanHijri, &k.SelesaiTanggal,
			&k.MasehiMulai, &k.MasehiSelesai); err != nil {
			return nil, err
		}
		res = append(res, k)
	}
	return res, nil
}

// SaveKalenderSemesterHijri upsert kalender semester + sinkronisasi
// kalender_kuartal (kompatibilitas rekap absensi & lock). Satu semester
// dibelah dua: paruh pertama = kuartal tamrin, paruh kedua = kuartal ujian.
func SaveKalenderSemesterHijri(ctx context.Context, entries []KalenderSemesterHijri) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, e := range entries {
		// Validasi rentang Hijri: mulai <= selesai.
		if hijriOrdinal(e.MulaiTahunHijri, e.MulaiBulanHijri, e.MulaiTanggal) >
			hijriOrdinal(e.SelesaiTahunHijri, e.SelesaiBulanHijri, e.SelesaiTanggal) {
			return fmt.Errorf("semester %d: tanggal mulai Hijriyah setelah tanggal selesai", e.Semester)
		}

		var masehiMulai, masehiSelesai interface{}
		if e.MasehiMulai != "" {
			masehiMulai = e.MasehiMulai
		}
		if e.MasehiSelesai != "" {
			masehiSelesai = e.MasehiSelesai
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO kalender_semester_hijri (tahun_ajaran, semester,
				mulai_tahun_hijri, mulai_bulan_hijri, mulai_tanggal,
				selesai_tahun_hijri, selesai_bulan_hijri, selesai_tanggal,
				masehi_mulai, masehi_selesai, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)
			ON CONFLICT (tahun_ajaran, semester) DO UPDATE SET
				mulai_tahun_hijri = EXCLUDED.mulai_tahun_hijri,
				mulai_bulan_hijri = EXCLUDED.mulai_bulan_hijri,
				mulai_tanggal = EXCLUDED.mulai_tanggal,
				selesai_tahun_hijri = EXCLUDED.selesai_tahun_hijri,
				selesai_bulan_hijri = EXCLUDED.selesai_bulan_hijri,
				selesai_tanggal = EXCLUDED.selesai_tanggal,
				masehi_mulai = EXCLUDED.masehi_mulai,
				masehi_selesai = EXCLUDED.masehi_selesai,
				updated_at = CURRENT_TIMESTAMP`,
			e.TahunAjaran, e.Semester,
			e.MulaiTahunHijri, e.MulaiBulanHijri, e.MulaiTanggal,
			e.SelesaiTahunHijri, e.SelesaiBulanHijri, e.SelesaiTanggal,
			masehiMulai, masehiSelesai); err != nil {
			return err
		}
	}

	// Sinkronkan kalender_kuartal dari ekuivalen Masehi tiap semester.
	// kuartal 1/2 = paruh semester 1; kuartal 3/4 = paruh semester 2.
	if _, err := tx.Exec(ctx, `
		INSERT INTO kalender_kuartal (kuartal, tahun_ajaran, tgl_mulai, tgl_selesai)
		SELECT k.kuartal, k.tahun_ajaran,
		       k.mulai + (idx - 1) * span,
		       CASE WHEN idx = 1 THEN k.mulai + span - 1 ELSE k.selesai END
		  FROM (
			SELECT semester, tahun_ajaran,
			       masehi_mulai::DATE AS mulai, masehi_selesai::DATE AS selesai,
			       GREATEST(((masehi_selesai::DATE - masehi_mulai::DATE + 1) / 2), 1) AS span
			  FROM kalender_semester_hijri
			 WHERE masehi_mulai IS NOT NULL AND masehi_selesai IS NOT NULL
		  ) base,
		  LATERAL (VALUES
			(CASE semester WHEN 1 THEN 1 ELSE 3 END, 1),
			(CASE semester WHEN 1 THEN 2 ELSE 4 END, 2)
		  ) k(kuartal, idx)
		ON CONFLICT (kuartal, tahun_ajaran)
		DO UPDATE SET tgl_mulai = EXCLUDED.tgl_mulai, tgl_selesai = EXCLUDED.tgl_selesai`); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// SemesterDariBulanHijri menentukan semester suatu bulan Hijriyah berdasarkan
// kalender semester tahun ajaran: hari ke-15 bulan itu jatuh di rentang
// semester mana. Mengembalikan 0 jika belum ada kalender / di luar rentang.
func SemesterDariBulanHijri(ctx context.Context, tahunAjaran string, tahunHijri, bulanHijri int) int {
	kals, err := GetKalenderSemesterHijri(ctx, tahunAjaran)
	if err != nil {
		return 0
	}
	tengah := hijriOrdinal(tahunHijri, bulanHijri, 15)
	for _, k := range kals {
		if tengah >= hijriOrdinal(k.MulaiTahunHijri, k.MulaiBulanHijri, k.MulaiTanggal) &&
			tengah <= hijriOrdinal(k.SelesaiTahunHijri, k.SelesaiBulanHijri, k.SelesaiTanggal) {
			return k.Semester
		}
	}
	return 0
}
