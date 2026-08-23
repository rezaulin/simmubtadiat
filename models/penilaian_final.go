package models

import (
	"context"
	"math"

	"github.com/mubtadiaat/app/config"
)

// GenerateNilaiAm menghitung Nilai 'Am (nilai العامة) untuk satu bagian per semester.
//
// Nilai 'Am adalah RATA-RATA KELAS (semua siswi dalam satu bagian) untuk TIAP mata
// pelajaran. Hasilnya satu angka per (bagian, mapel, semester), bukan per siswi.
// Siswi yang belum menyelesaikan Her Ujian diberi nilai 4 untuk mapel tersebut saja.
func GenerateNilaiAm(ctx context.Context, bagianID int, semester int, tahunAjaran string) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	q1, q2 := 1, 2
	if semester == 2 {
		q1, q2 = 3, 4
	}

	// Ambil daftar mapel untuk bagian ini (mapel terikat ke kelas + tingkatan bagian).
	// Mapel relevan untuk semester ini jika aktif_kuartal mengandung setidaknya
	// satu kwartal dari semester ini (q1 atau q2).
	mapelRows, err := tx.Query(ctx,
		`SELECT m.id FROM mata_pelajaran m
		 JOIN bagian b ON b.id = $1
		 WHERE m.kelas_id = b.kelas_id AND m.tingkatan_id = b.tingkatan_id
		       AND (m.aktif_kuartal @> to_jsonb($2::int) OR m.aktif_kuartal @> to_jsonb($3::int))`, 
		 bagianID, q1, q2)
	if err != nil {
		return err
	}
	var mapelIDs []int
	for mapelRows.Next() {
		var id int
		if err := mapelRows.Scan(&id); err != nil {
			mapelRows.Close()
			return err
		}
		mapelIDs = append(mapelIDs, id)
	}
	mapelRows.Close()

	for _, mapelID := range mapelIDs {
		// Untuk tiap siswi di bagian, tentukan nilai Khos-nya untuk mapel ini.
		// Jika siswi punya Her yang belum selesai (is_her=true, nilai NULL) di semester ini,
		// nilainya dianggap 4 untuk mapel tersebut.
		rows, err := tx.Query(ctx,
			`SELECT 
				s.id,
				nk.nilai_akhir,
				COALESCE(BOOL_OR(kh.is_her AND kh.nilai IS NULL), false) AS her_belum_selesai
			 FROM santri s
			 LEFT JOIN nilai_khos nk 
			   ON nk.santri_id = s.id AND nk.mapel_id = $2 AND nk.semester = $3 AND nk.tahun_ajaran = $6
			 LEFT JOIN nilai_kuartal kh 
			   ON kh.santri_id = s.id AND kh.mapel_id = $2 AND kh.kuartal IN ($4, $5) AND kh.tahun_ajaran = $6
			 WHERE s.bagian_id = $1 AND s.status = 'aktif'
			 GROUP BY s.id, nk.nilai_akhir`,
			bagianID, mapelID, semester, q1, q2, tahunAjaran)
		if err != nil {
			return err
		}

		var sum float64
		var count int
		for rows.Next() {
			var santriID int
			var nilaiKhos *float64
			var herBelum bool
			if err := rows.Scan(&santriID, &nilaiKhos, &herBelum); err != nil {
				rows.Close()
				return err
			}

			var nilai float64
			switch {
			case herBelum:
				nilai = 4.0 // belum Her -> nilai 4 untuk mapel ini
			case nilaiKhos != nil:
				nilai = *nilaiKhos
			default:
				continue // siswi belum punya nilai Khos & bukan karena Her -> abaikan
			}
			sum += nilai
			count++
		}
		rows.Close()

		if count == 0 {
			continue // tidak ada data untuk mapel ini
		}

		nilaiAm := sum / float64(count)
		nilaiAm = math.Round(nilaiAm*100) / 100 // 2 angka di belakang koma

		_, err = tx.Exec(ctx,
			`INSERT INTO nilai_am (bagian_id, mapel_id, semester, tahun_ajaran, nilai_am, is_edited)
			 VALUES ($1, $2, $3, $4, $5, false)
			 ON CONFLICT (bagian_id, mapel_id, semester, tahun_ajaran)
			 DO UPDATE SET nilai_am = EXCLUDED.nilai_am, updated_at = CURRENT_TIMESTAMP`,
			bagianID, mapelID, semester, tahunAjaran, nilaiAm)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GenerateAlBayan menghitung label Al-Bayan tahunan untuk seorang siswi.
//
// Aturan:
//   - Nilai dasar = rata-rata Nilai Khos SEMUA mapel dari 2 semester.
//   - Pembulatan setengah ke atas.
//   - Koreksi absensi tahunan INDEPENDEN dengan KEKELIPATAN: 
//     Bi Idzni >= 15/tahun -> -1, tiap 15 hari lagi -> -1 lagi (55 hari = -3)
//     Bi Ghoirihi >= 5/tahun -> -1, tiap 5 hari lagi -> -1 lagi
//     Floor(hari / ambang) = jumlah pengurangan total
//   - Batas nilai akhir: minimal 5, maksimal 9.
//   - Label: 9=الجيد الأول, 8=الجيد الثاني, 7=المتوسط الأول, 6=المتوسط الثاني, 5=الردي.
func GenerateAlBayan(ctx context.Context, santriID int, tahunAjaran string) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Rata-rata Khos semua mapel dari 2 semester.
	var avg *float64
	var count int
	err = tx.QueryRow(ctx,
		`SELECT AVG(nilai_akhir), COUNT(id)
		 FROM nilai_khos
		 WHERE santri_id = $1 AND semester IN (1, 2) AND tahun_ajaran = $2`, santriID, tahunAjaran).Scan(&avg, &count)
	if err != nil {
		return err
	}

	if count == 0 || avg == nil {
		return nil // belum ada nilai Khos, tidak bisa hitung Al-Bayan
	}

	rataRata := *avg

	// Koreksi absensi tahunan (independen). Difilter per tahun ajaran (perbaikan
	// bug lama yang menjumlah lintas seluruh tahun). Satuan tersimpan = PERTEMUAN,
	// dikonversi ke HARI (ceil ½) di level tahun.
	var totalIzin, totalAlpha int
	err = tx.QueryRow(ctx,
		`SELECT COALESCE(SUM(ra.total_izin), 0), COALESCE(SUM(ra.total_alpha), 0)
		 FROM rekap_absensi ra
		 JOIN kalender_kuartal kk ON ra.kuartal_id = kk.id
		 WHERE ra.santri_id = $1 AND kk.tahun_ajaran = $2`, santriID, tahunAjaran).Scan(&totalIzin, &totalAlpha)
	if err != nil {
		return err
	}

	izinHari := PertemuanKeHari(totalIzin)
	alphaHari := PertemuanKeHari(totalAlpha)

	// Tambahkan data absensi manual bulanan (sudah dalam hari).
	var manualIzin, manualAlpha int
	_ = tx.QueryRow(ctx,
		`SELECT COALESCE(SUM(total_izin), 0), COALESCE(SUM(total_alpha), 0)
		 FROM absensi_manual_bulanan
		 WHERE santri_id = $1 AND tahun_ajaran = $2`, santriID, tahunAjaran).Scan(&manualIzin, &manualAlpha)

	izinHari += manualIzin
	alphaHari += manualAlpha

	koreksi := 0
	// Kelipatan: floor(hari / ambang) = jumlah pengurangan
	if izinHari >= 15 {
		koreksi -= izinHari / 15
	}
	if alphaHari >= 5 {
		koreksi -= alphaHari / 5
	}

	finalScore := math.Floor(rataRata+0.5) + float64(koreksi)
	if finalScore < 5 {
		finalScore = 5
	} else if finalScore > 9 {
		finalScore = 9
	}

	// Konversi Label. Skala Al-Bayan 5-9: tidak ada Mumtaz,
	// nilai tertinggi = 9 (الجيد الأول / Jayyid Awal).
	var label string
	switch finalScore {
	case 9:
		label = "الجيد الأول"
	case 8:
		label = "الجيد الثاني"
	case 7:
		label = "المتوسط الأول"
	case 6:
		label = "المتوسط الثاني"
	case 5:
		label = "الردي"
	}

	// Get bagian_id
	var bagianID int
	err = tx.QueryRow(ctx, `SELECT bagian_id FROM santri WHERE id = $1`, santriID).Scan(&bagianID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO nilai_bayan (santri_id, bagian_id, tahun_ajaran, kategori_id, label_arab, nilai_angka, nilai_label)
		 VALUES ($1, $2, $3, $4, $5, $4, $5)
		 ON CONFLICT (santri_id, tahun_ajaran)
		 DO UPDATE SET kategori_id = EXCLUDED.kategori_id, label_arab = EXCLUDED.label_arab,
		               nilai_angka = EXCLUDED.nilai_angka, nilai_label = EXCLUDED.nilai_label,
		               updated_at = CURRENT_TIMESTAMP`,
		santriID, bagianID, tahunAjaran, int(finalScore), label)

	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}
