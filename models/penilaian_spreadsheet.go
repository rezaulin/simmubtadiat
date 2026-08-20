package models

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/mubtadiaat/app/config"
)

// GetPenilaianSpreadsheet returns all grading data for one bagian in a single response,
// suitable for rendering a full spreadsheet view.
func GetPenilaianSpreadsheet(ctx context.Context, bagianID int, tahunAjaran string) (map[string]interface{}, error) {
	// 1. Get kelas_id and tingkatan_id from bagian
	var kelasID, tingkatanID int
	err := config.DB.QueryRow(ctx,
		"SELECT kelas_id, tingkatan_id FROM bagian WHERE id = $1", bagianID).Scan(&kelasID, &tingkatanID)
	if err != nil {
		return nil, fmt.Errorf("gagal mendapatkan data bagian: %v", err)
	}

	// 2. Fetch all mata_pelajaran for this kelas+tingkatan
	rowsMapel, err := config.DB.Query(ctx,
		"SELECT id, nama_mapel, nama_kitab, kategori, aktif_kuartal FROM mata_pelajaran WHERE kelas_id = $1 AND tingkatan_id = $2 ORDER BY urutan ASC",
		kelasID, tingkatanID)
	if err != nil {
		return nil, fmt.Errorf("gagal mendapatkan mapel: %v", err)
	}
	defer rowsMapel.Close()

	var mapels []map[string]interface{}
	for rowsMapel.Next() {
		var id int
		var nama, kategori string
		var namaKitab *string
		var aktifJSON []byte
		if err := rowsMapel.Scan(&id, &nama, &namaKitab, &kategori, &aktifJSON); err != nil {
			return nil, err
		}
		
		nk := ""
		if namaKitab != nil {
			nk = *namaKitab
		}

		var aktifKuartal []int
		if err := json.Unmarshal(aktifJSON, &aktifKuartal); err != nil {
			aktifKuartal = []int{1, 2, 3, 4}
		}
		
		mapels = append(mapels, map[string]interface{}{
			"id":             id,
			"nama":           nama,
			"nama_kitab":     nk,
			"kategori":       kategori,
			"aktif_kuartal":  aktifKuartal,
		})
	}

	// 3. Fetch santri yang masih aktif di bagian ini.
	rowsSantri, err := config.DB.Query(ctx,
		`SELECT id, nama, COALESCE(stambuk, '') FROM santri
		 WHERE bagian_id = $1 AND status = 'aktif'
		 ORDER BY nama ASC`,
		bagianID)
	if err != nil {
		return nil, fmt.Errorf("gagal mendapatkan santri: %v", err)
	}
	defer rowsSantri.Close()

	var santriList []map[string]interface{}
	var santriIDs []int
	for rowsSantri.Next() {
		var id int
		var nama, stambuk string
		if err := rowsSantri.Scan(&id, &nama, &stambuk); err != nil {
			return nil, err
		}
		santriList = append(santriList, map[string]interface{}{
			"id":             id,
			"nama":           nama,
			"stambuk":  stambuk,
		})
		santriIDs = append(santriIDs, id)
	}

	if len(santriIDs) == 0 {
		return map[string]interface{}{
			"mapels":        mapels,
			"santri":        santriList,
			"nilai_kuartal": map[string]interface{}{},
			"nilai_khos":    map[string]interface{}{},
			"nilai_bayan":   map[string]interface{}{},
			"absensi":       map[string]interface{}{},
		}, nil
	}

	// 4. Fetch all nilai_kuartal for these santri + tahun_ajaran
	nilaiKuartal := map[string]map[string]float64{
		"1": {}, "2": {}, "3": {}, "4": {},
	}
	rowsNK, err := config.DB.Query(ctx,
		`SELECT santri_id, mapel_id, kuartal, nilai
		 FROM nilai_kuartal
		 WHERE santri_id = ANY($1) AND tahun_ajaran = $2`,
		santriIDs, tahunAjaran)
	if err != nil {
		return nil, fmt.Errorf("gagal mendapatkan nilai kuartal: %v", err)
	}
	defer rowsNK.Close()

	for rowsNK.Next() {
		var santriID, mapelID, kuartal int
		var nilai float64
		if err := rowsNK.Scan(&santriID, &mapelID, &kuartal, &nilai); err != nil {
			return nil, err
		}
		key := strconv.Itoa(santriID) + "_" + strconv.Itoa(mapelID)
		q := strconv.Itoa(kuartal)
		nilaiKuartal[q][key] = nilai
	}

	// 5. Fetch all nilai_khos for these santri + tahun_ajaran (both semesters)
	nilaiKhos := map[string]map[string]float64{
		"1": {}, "2": {},
	}
	rowsKhos, err := config.DB.Query(ctx,
		`SELECT santri_id, mapel_id, semester, nilai_akhir
		 FROM nilai_khos
		 WHERE santri_id = ANY($1) AND tahun_ajaran = $2`,
		santriIDs, tahunAjaran)
	if err != nil {
		return nil, fmt.Errorf("gagal mendapatkan nilai khos: %v", err)
	}
	defer rowsKhos.Close()

	for rowsKhos.Next() {
		var santriID, mapelID, semester int
		var nilaiAkhir float64
		if err := rowsKhos.Scan(&santriID, &mapelID, &semester, &nilaiAkhir); err != nil {
			return nil, err
		}
		key := strconv.Itoa(santriID) + "_" + strconv.Itoa(mapelID)
		s := strconv.Itoa(semester)
		nilaiKhos[s][key] = nilaiAkhir
	}

	// 6. Fetch nilai_bayan for these santri + tahun_ajaran
	nilaiBayan := map[string]map[string]interface{}{}
	rowsBayan, err := config.DB.Query(ctx,
		`SELECT santri_id, nilai_angka, label_arab
		 FROM nilai_bayan
		 WHERE santri_id = ANY($1) AND bagian_id = $2 AND tahun_ajaran = $3`,
		santriIDs, bagianID, tahunAjaran)
	if err != nil {
		return nil, fmt.Errorf("gagal mendapatkan nilai bayan: %v", err)
	}
	defer rowsBayan.Close()

	for rowsBayan.Next() {
		var santriID int
		var nilaiAngka *int
		var labelArab *string
		if err := rowsBayan.Scan(&santriID, &nilaiAngka, &labelArab); err != nil {
			return nil, err
		}
		entry := map[string]interface{}{}
		if nilaiAngka != nil {
			entry["nilai_asli"] = *nilaiAngka
			entry["hasil_akhir"] = *nilaiAngka
		}
		if labelArab != nil {
			entry["label"] = *labelArab
		}
		nilaiBayan[strconv.Itoa(santriID)] = entry
	}

	// 7. Fetch absensi totals: combine rekap_absensi (pertemuan→hari) + absensi_manual_bulanan (hari)
	absensi := map[string]map[string]int{}

	// 7a. rekap_absensi (satuan pertemuan, grouped by santri via kalender_kuartal for tahun_ajaran)
	rowsRekap, err := config.DB.Query(ctx,
		`SELECT ra.santri_id, COALESCE(SUM(ra.total_izin), 0), COALESCE(SUM(ra.total_alpha), 0)
		 FROM rekap_absensi ra
		 JOIN kalender_kuartal kk ON ra.kuartal_id = kk.id
		 WHERE ra.santri_id = ANY($1) AND kk.tahun_ajaran = $2
		 GROUP BY ra.santri_id`,
		santriIDs, tahunAjaran)
	if err != nil {
		return nil, fmt.Errorf("gagal mendapatkan rekap absensi: %v", err)
	}
	defer rowsRekap.Close()

	for rowsRekap.Next() {
		var santriID, totalIzin, totalAlpha int
		if err := rowsRekap.Scan(&santriID, &totalIzin, &totalAlpha); err != nil {
			return nil, err
		}
		key := strconv.Itoa(santriID)
		absensi[key] = map[string]int{
			"izin":  PertemuanKeHari(totalIzin),
			"alpha": PertemuanKeHari(totalAlpha),
		}
	}

	// 7b. absensi_manual_bulanan (already in hari)
	rowsManual, err := config.DB.Query(ctx,
		`SELECT santri_id, COALESCE(SUM(total_izin), 0), COALESCE(SUM(total_alpha), 0)
		 FROM absensi_manual_bulanan
		 WHERE santri_id = ANY($1) AND tahun_ajaran = $2
		 GROUP BY santri_id`,
		santriIDs, tahunAjaran)
	if err != nil {
		return nil, fmt.Errorf("gagal mendapatkan absensi manual: %v", err)
	}
	defer rowsManual.Close()

	for rowsManual.Next() {
		var santriID, manualIzin, manualAlpha int
		if err := rowsManual.Scan(&santriID, &manualIzin, &manualAlpha); err != nil {
			return nil, err
		}
		key := strconv.Itoa(santriID)
		if _, ok := absensi[key]; !ok {
			absensi[key] = map[string]int{"izin": 0, "alpha": 0}
		}
		absensi[key]["izin"] += manualIzin
		absensi[key]["alpha"] += manualAlpha
	}

	return map[string]interface{}{
		"mapels":        mapels,
		"santri":        santriList,
		"nilai_kuartal": nilaiKuartal,
		"nilai_khos":    nilaiKhos,
		"nilai_bayan":   nilaiBayan,
		"absensi":       absensi,
	}, nil
}
