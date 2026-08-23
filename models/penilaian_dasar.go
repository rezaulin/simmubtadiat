package models

import (
	"context"
	"encoding/json"
	"fmt"
	"math"

	"github.com/mubtadiaat/app/config"
)

type NilaiKuartalInput struct {
	SantriID int     `json:"santri_id"`
	MapelID  int     `json:"mapel_id"`
	Kuartal  int     `json:"kuartal"`
	Nilai    float64 `json:"nilai"`
	IsHer    bool    `json:"is_her"`
}

// maxNilaiKuartal mengembalikan batas atas nilai kuartal berdasarkan kategori mapel.
// Al-Qur'an & Akhlaq maksimal 8, mapel lain maksimal 10.
func maxNilaiKuartal(kategori string) float64 {
	switch kategori {
	case "al_quran", "akhlaq", "akhlaq_perilaku":
		return 8.0
	default:
		return 10.0
	}
}

// BulkInputNilaiKuartal inserts or updates multiple Kuartal scores.
// Memvalidasi batas nilai per kategori mapel dan kelipatan 0.5 (boleh setengah).
func BulkInputNilaiKuartal(ctx context.Context, inputs []NilaiKuartalInput, tahunAjaran string) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, input := range inputs {
		// Ambil kategori mapel untuk menentukan batas nilai.
		var kategori string
		if err := tx.QueryRow(ctx, `SELECT kategori FROM mata_pelajaran WHERE id = $1`, input.MapelID).Scan(&kategori); err != nil {
			return fmt.Errorf("mapel id %d tidak ditemukan: %w", input.MapelID, err)
		}

		// Validasi: nilai tidak boleh negatif, tidak melebihi batas kategori,
		// dan hanya boleh kelipatan 0.5.
		batasAtas := maxNilaiKuartal(kategori)
		if input.Nilai < 0 || input.Nilai > batasAtas {
			return fmt.Errorf("nilai %.2f untuk mapel id %d di luar rentang 0-%.0f", input.Nilai, input.MapelID, batasAtas)
		}
		if math.Mod(input.Nilai*2, 1) != 0 {
			return fmt.Errorf("nilai %.2f untuk mapel id %d harus kelipatan 0.5", input.Nilai, input.MapelID)
		}

		_, err := tx.Exec(ctx,
			`INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai, is_her, tahun_ajaran)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (santri_id, mapel_id, kuartal, tahun_ajaran)
			 DO UPDATE SET nilai = EXCLUDED.nilai, is_her = EXCLUDED.is_her, updated_at = CURRENT_TIMESTAMP`,
			input.SantriID, input.MapelID, input.Kuartal, input.Nilai, input.IsHer, tahunAjaran)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

type NilaiKhosInput struct {
	SantriID int     `json:"santri_id"`
	MapelID  int     `json:"mapel_id"`
	Semester int     `json:"semester"`
	Nilai    float64 `json:"nilai"`
}

// BulkInputNilaiKhos menyimpan atau memperbarui nilai Khos (Nilai Raport) secara manual.
func BulkInputNilaiKhos(ctx context.Context, inputs []NilaiKhosInput, tahunAjaran string) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, input := range inputs {
		var kategori string
		if err := tx.QueryRow(ctx, `SELECT kategori FROM mata_pelajaran WHERE id = $1`, input.MapelID).Scan(&kategori); err != nil {
			return fmt.Errorf("mapel id %d tidak ditemukan: %w", input.MapelID, err)
		}

		if input.Nilai < 4 || input.Nilai > 9 {
			return fmt.Errorf("nilai raport %.2f untuk mapel id %d tidak valid. Harus antara 4 dan 9", input.Nilai, input.MapelID)
		}

		_, err := tx.Exec(ctx,
			`INSERT INTO nilai_khos (santri_id, mapel_id, semester, tahun_ajaran, nilai_akhir)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (santri_id, mapel_id, semester, tahun_ajaran)
			 DO UPDATE SET nilai_akhir = EXCLUDED.nilai_akhir, updated_at = CURRENT_TIMESTAMP`,
			input.SantriID, input.MapelID, input.Semester, tahunAjaran, input.Nilai)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GenerateNilaiKhos calculates Nilai Khos for a semester.
//
// Aturan:
//   - K1/K3 = nilai tamrin, K2/K4 = nilai ujian.
//   - Jika mapel aktif di KEDUA kwartal semester: Khos = (tamrin + ujian) / 2.
//   - Jika mapel hanya aktif di SATU kwartal: Khos = nilai kwartal itu langsung.
//   - Jika tamrin (K1/K3) kosong tapi mapel aktif di kedua kwartal, Khos = ujian / 2.
//   - Jika kwartal aktif belum ada nilainya, mapel TIDAK dihitung (Khos tidak disimpan).
//   - Pembulatan setengah ke atas (>= .5 naik).
//   - Batas Khos: minimal 4, maksimal 9.
//   - Koreksi absensi HANYA untuk kategori 'akhlaq_perilaku' (baris الأخلاق di raport),
//   - Bi Idzni dan Bi Ghoirihi bersifat INDEPENDEN (bisa turun sampai 2).
func GenerateNilaiKhos(ctx context.Context, santriID int, semester int, tahunAjaran string) error {
	// 1. Get kuartal numbers based on semester
	q1, q2 := 1, 2
	if semester == 2 {
		q1, q2 = 3, 4
	}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1.5 Cleanup khos: hapus semua baris khos milik mapel kelas lama jika santri
	// sudah punya nilai kuartal di kelas SEKARANG. nilai_kuartal (sumber data)
	// tidak disentuh — tetap tersimpan sebagai arsip.
	_, err = tx.Exec(ctx,
		`DELETE FROM nilai_khos nk
		 WHERE nk.santri_id = $1 AND nk.tahun_ajaran = $2
		   AND EXISTS (
		       SELECT 1 FROM mata_pelajaran m
		       JOIN santri s ON s.id = $1
		       JOIN bagian b ON b.id = s.bagian_id
		       WHERE m.id = nk.mapel_id
		         AND NOT (m.kelas_id = b.kelas_id AND m.tingkatan_id = b.tingkatan_id)
		         AND EXISTS (
		             SELECT 1 FROM nilai_kuartal nk4
		             JOIN mata_pelajaran m4 ON m4.id = nk4.mapel_id
		             WHERE nk4.santri_id = $1 AND nk4.tahun_ajaran = $2
		               AND m4.kelas_id = b.kelas_id AND m4.tingkatan_id = b.tingkatan_id
		         )
		   )`, santriID, tahunAjaran)
	if err != nil {
		return err
	}

	// 2. Calculate raw Khos for each mapel. Sumber mapel = mapel kelas/tingkatan
	//    bagian santri SEKARANG, DITAMBAH mapel di kelas lama tempat santri ini
	//    punya nilai kuartal pada tahun ajaran ini (nilai tetap di kelas lama,
	//    tidak di-relink — sesuai keputusan operasional).
	//    aktif_kuartal adalah JSONB array, contoh [1,2,3,4] atau [3].
	//    Mapel relevan untuk semester ini jika aktif_kuartal mengandung
	//    setidaknya satu kwartal dari semester.
	rows, err := tx.Query(ctx,
		`SELECT 
			m.id as mapel_id,
			m.kategori,
			m.aktif_kuartal,
			MAX(CASE WHEN nk.kuartal = $1 THEN nk.nilai END) as nilai_q1,
			MAX(CASE WHEN nk.kuartal = $2 THEN nk.nilai END) as nilai_q2
		 FROM mata_pelajaran m
		 JOIN santri s ON s.id = $3
		 JOIN bagian b ON b.id = s.bagian_id
		 LEFT JOIN nilai_kuartal nk ON m.id = nk.mapel_id AND nk.santri_id = $3 AND nk.tahun_ajaran = $4
		 WHERE ((m.kelas_id = b.kelas_id AND m.tingkatan_id = b.tingkatan_id)
		        OR (
		            -- Mapel kelas lama hanya dihitung jika santri BELUM punya nilai
		            -- apapun di kelas SEKARANG (mis. AINI). Begitu ada nilai di kelas
		            -- sekarang, SEMUA mapel kelas lama diabaikan — nilai kuartal kelas
		            -- lama tetap tersimpan sebagai arsip, tapi tidak dihitung.
		            NOT EXISTS (
		                SELECT 1 FROM nilai_kuartal nk4
		                JOIN mata_pelajaran m4 ON m4.id = nk4.mapel_id
		                WHERE nk4.santri_id = $3 AND nk4.tahun_ajaran = $4
		                  AND m4.kelas_id = b.kelas_id AND m4.tingkatan_id = b.tingkatan_id
		            )
		            AND EXISTS (SELECT 1 FROM nilai_kuartal nk2
		                        WHERE nk2.mapel_id = m.id AND nk2.santri_id = $3 AND nk2.tahun_ajaran = $4)
		        ))
		       AND (m.aktif_kuartal @> to_jsonb($1::int) OR m.aktif_kuartal @> to_jsonb($2::int))
		 GROUP BY m.id`, q1, q2, santriID, tahunAjaran)

	if err != nil {
		return err
	}
	defer rows.Close()

	type MapelKhos struct {
		MapelID  int
		Kategori string
		Nilai    float64
	}
	var mapelKhos []MapelKhos

	for rows.Next() {
		var mapelID int
		var kategori string
		var aktifJSON []byte
		var nQ1, nQ2 *float64
		if err := rows.Scan(&mapelID, &kategori, &aktifJSON, &nQ1, &nQ2); err != nil {
			return err
		}

		// Parse aktif_kuartal untuk menentukan kwartal mana yang aktif di semester ini.
		var aktifKuartal []int
		json.Unmarshal(aktifJSON, &aktifKuartal)

		aktifQ1 := containsInt(aktifKuartal, q1) // tamrin kwartal
		aktifQ2 := containsInt(aktifKuartal, q2) // ujian kwartal

		var rawKhos float64
		var hasValue bool

		switch {
		case aktifQ1 && aktifQ2:
			// Mapel aktif di kedua kwartal semester → aturan lama
			if nQ2 == nil {
				continue // ujian belum ada → mapel tidak dihitung dulu
			}
			if nQ1 != nil {
				rawKhos = (*nQ1 + *nQ2) / 2.0
			} else {
				rawKhos = *nQ2 / 2.0 // tamrin kosong → ujian / 2
			}
			hasValue = true

		case aktifQ1 && !aktifQ2:
			// Mapel HANYA aktif di kwartal ganjil (tamrin) → Khos = nilai tamrin langsung
			if nQ1 == nil {
				continue
			}
			rawKhos = *nQ1
			hasValue = true

		case !aktifQ1 && aktifQ2:
			// Mapel HANYA aktif di kwartal genap (ujian) → Khos = nilai ujian langsung
			if nQ2 == nil {
				continue
			}
			rawKhos = *nQ2
			hasValue = true
		}

		if hasValue {
			mapelKhos = append(mapelKhos, MapelKhos{MapelID: mapelID, Kategori: kategori, Nilai: rawKhos})
		}
	}
	rows.Close()

	// 3. Koreksi absensi untuk akhlaq-perilaku (per semester).
	//    Bi Idzni >= 20/semester -> -1, tiap kelipatan 20 lagi -> -1 lagi.
	//    Bi Ghoirihi >= 6/semester -> -1, tiap kelipatan 6 lagi -> -1 lagi.
	//    Sumber 1: rekap_absensi (dari ustadz, satuan PERTEMUAN → konversi hari).
	var totalIzin, totalAlpha int
	err = tx.QueryRow(ctx,
		`SELECT 
			COALESCE(SUM(total_izin), 0), COALESCE(SUM(total_alpha), 0)
		 FROM rekap_absensi ra
		 JOIN kalender_kuartal kk ON ra.kuartal_id = kk.id
		 WHERE ra.santri_id = $1 AND kk.kuartal IN ($2, $3) AND kk.tahun_ajaran = $4`, santriID, q1, q2, tahunAjaran).Scan(&totalIzin, &totalAlpha)

	if err != nil {
		return err
	}

	// total_izin/total_alpha kini bersatuan PERTEMUAN → konversi ke HARI (ceil ½)
	// di level semester (jumlahkan pertemuan 2 kuartal dulu, baru ceil sekali).
	izinHari := PertemuanKeHari(totalIzin)
	alphaHari := PertemuanKeHari(totalAlpha)

	// Sumber 2: absensi_manual_bulanan (langsung hari), difilter per semester —
	// bulan Hijri yang sudah di-mapping hanya membebani semester tersebut.
	var manualIzin, manualAlpha int
	_ = tx.QueryRow(ctx,
		`SELECT COALESCE(SUM(total_izin), 0), COALESCE(SUM(total_alpha), 0)
		 FROM absensi_manual_bulanan
		 WHERE santri_id = $1 AND tahun_ajaran = $2 AND semester = $3`, santriID, tahunAjaran, semester).Scan(&manualIzin, &manualAlpha)

	// Gabungkan: data ustadz (konversi hari) + data manual (sudah hari).
	izinHari += manualIzin
	alphaHari += manualAlpha

	// Kelipatan: floor(hari / ambang) = jumlah pengurangan
	koreksiAkhlaq := 0
	if izinHari >= 20 {
		koreksiAkhlaq -= izinHari / 20
	}
	if alphaHari >= 6 {
		koreksiAkhlaq -= alphaHari / 6
	}

	// 4. Apply correction, rounding, and limits
	for _, mk := range mapelKhos {
		finalKhos := mk.Nilai
		if mk.Kategori == "akhlaq_perilaku" {
			finalKhos += float64(koreksiAkhlaq)
		}

		// Rounding: >= 0.5 up, < 0.5 down
		finalKhos = math.Floor(finalKhos + 0.5)

		// Limits: min 4, max 9
		if finalKhos < 4 {
			finalKhos = 4
		} else if finalKhos > 9 {
			finalKhos = 9
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO nilai_khos (santri_id, mapel_id, semester, tahun_ajaran, nilai_akhir)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (santri_id, mapel_id, semester, tahun_ajaran)
			 DO UPDATE SET nilai_akhir = EXCLUDED.nilai_akhir, updated_at = CURRENT_TIMESTAMP`,
			santriID, mk.MapelID, semester, tahunAjaran, finalKhos)

		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// containsInt checks if a slice of ints contains a specific value.
func containsInt(slice []int, val int) bool {
	for _, v := range slice {
		if v == val {
			return true
		}
	}
	return false
}

type NilaiBayanInput struct {
	SantriID   int `json:"santri_id"`
	HasilAkhir int `json:"hasil_akhir"`
}

// BulkInputNilaiBayan menyimpan override manual nilai Al-Bayan.
func BulkInputNilaiBayan(ctx context.Context, inputs []NilaiBayanInput, tahunAjaran string) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, input := range inputs {
		if input.HasilAkhir < 0 || input.HasilAkhir > 9 {
			return fmt.Errorf("nilai al-bayan %d untuk santri id %d tidak valid. Harus antara 0 dan 9", input.HasilAkhir, input.SantriID)
		}

		// Konversi Label. Skala Al-Bayan maksimal 9, tanpa batas bawah.
		// Nilai 5 ke bawah semua = الرديء (dengan hamzah).
		var label string
		switch {
		case input.HasilAkhir >= 9:
			label = "الجيد الأول"
		case input.HasilAkhir >= 8:
			label = "الجيد الثاني"
		case input.HasilAkhir >= 7:
			label = "المتوسط الأول"
		case input.HasilAkhir >= 6:
			label = "المتوسط الثاني"
		default:
			label = "الرديء"
		}

		var bagianID int
		err := tx.QueryRow(ctx, `SELECT bagian_id FROM santri WHERE id = $1`, input.SantriID).Scan(&bagianID)
		if err != nil {
			return fmt.Errorf("santri id %d tidak ditemukan: %w", input.SantriID, err)
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO nilai_bayan (santri_id, bagian_id, tahun_ajaran, kategori_id, label_arab, nilai_angka, nilai_label)
			 VALUES ($1, $2, $3, $4, $5, $4, $5)
			 ON CONFLICT (santri_id, tahun_ajaran)
			 DO UPDATE SET kategori_id = EXCLUDED.kategori_id, label_arab = EXCLUDED.label_arab,
			               nilai_angka = EXCLUDED.nilai_angka, nilai_label = EXCLUDED.nilai_label,
			               updated_at = CURRENT_TIMESTAMP`,
			input.SantriID, bagianID, tahunAjaran, input.HasilAkhir, label)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
