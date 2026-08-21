package models

import (
	"context"
	"fmt"
	"strconv"

	"github.com/mubtadiaat/app/config"
)

type SearchResult struct {
	Tipe      string      `json:"tipe"` // "santri", "alumni", "pengajar", "dewan_harian"
	ID        int         `json:"id"`
	Nama      string      `json:"nama"`
	Detail    string      `json:"detail"` // Stambuk, NIK, atau nama bagian
	DataUtama interface{} `json:"data_utama"`
}

// DataUtamaSantri includes academic details
type DataUtamaSantri struct {
	Stambuk      string      `json:"stambuk"`
	Bagian       *string     `json:"bagian,omitempty"`
	Status       string      `json:"status"`
	NilaiKuartal interface{} `json:"nilai_kuartal,omitempty"` // Bisa di-nil-kan oleh handler
	NilaiKhos    interface{} `json:"nilai_khos,omitempty"`    // Bisa di-nil-kan oleh handler
	AlBayan      interface{} `json:"al_bayan,omitempty"`
	KhidmahTempat *string    `json:"khidmah_tempat,omitempty"`
}

func GlobalSearch(ctx context.Context, query string, roles []string, pengajarID *int) ([]SearchResult, error) {
	searchTerm := fmt.Sprintf("%%%s%%", query)
	var results []SearchResult

	isGlobal := false
	canSearchAlumni := false
	for _, role := range roles {
		if role == "pimpinan" || role == "admin" || role == "keamanan" || role == "mufatish" {
			isGlobal = true
		}
		if role == "pimpinan" || role == "admin" || role == "keamanan" {
			canSearchAlumni = true
		}
	}

	// 1. Search Santri (Active)
	qSantri := `SELECT s.id, s.nama, s.stambuk, s.status, b.nama_bagian, s.khidmah_tempat
		 FROM santri s
		 LEFT JOIN bagian b ON s.bagian_id = b.id
		 WHERE (s.nama ILIKE $1 OR s.stambuk ILIKE $1) AND s.status IN ('aktif','pengabdian')`
	argsSantri := []interface{}{searchTerm}

	if !isGlobal {
		if pengajarID != nil {
			argsSantri = append(argsSantri, *pengajarID)
			qSantri += ` AND EXISTS (
				SELECT 1 FROM bagian b_mus
				JOIN mustahiq_bagian mb ON mb.bagian_id = b_mus.id
				WHERE mb.pengajar_id = $` + strconv.Itoa(len(argsSantri)) + ` AND b_mus.tingkatan_id = b.tingkatan_id AND b_mus.kelas_id = b.kelas_id
			)`
		}
	}

	qSantri += ` LIMIT 10`

	rowsSantri, err := config.DB.Query(ctx, qSantri, argsSantri...)

	if err == nil {
		defer rowsSantri.Close()
		for rowsSantri.Next() {
			var id int
			var nama, status string
			var stambuk, bagian, khidmahTempat *string
			if err := rowsSantri.Scan(&id, &nama, &stambuk, &status, &bagian, &khidmahTempat); err == nil {
				stbVal := ""
				if stambuk != nil {
					stbVal = *stambuk
				}
				dataSantri := DataUtamaSantri{
					Stambuk: stbVal,
					Status:  status,
				}
				if bagian != nil {
					dataSantri.Bagian = bagian
				}
				if khidmahTempat != nil {
					dataSantri.KhidmahTempat = khidmahTempat
				}

				results = append(results, SearchResult{
					Tipe:      "santri",
					ID:        id,
					Nama:      nama,
					Detail:    stbVal,
					DataUtama: dataSantri,
				})
			}
		}
	}

		// 2. Search Alumni/arsip — SEMUA santri non-aktif & non-pengabdian
	//    (lulus, boyong, keluar, cuti, dst.), selaras dengan logika arsip
	//    (GetArsipSantri: status != 'aktif').
	if canSearchAlumni {
		rowsAlumni, err := config.DB.Query(ctx,
			`SELECT s.id, s.nama, s.stambuk, s.status
			 FROM santri s
			 WHERE (s.nama ILIKE $1 OR s.stambuk ILIKE $1 OR s.nik ILIKE $1)
			   AND s.status NOT IN ('aktif','pengabdian')
			 LIMIT 10`, searchTerm)

		if err == nil {
			defer rowsAlumni.Close()
			for rowsAlumni.Next() {
				var id int
				var nama, status string
				var stambuk *string
				if err := rowsAlumni.Scan(&id, &nama, &stambuk, &status); err == nil {
					stbVal := ""
					if stambuk != nil {
						stbVal = *stambuk
					}
					results = append(results, SearchResult{
						Tipe:      "alumni",
						ID:        id,
						Nama:      nama,
						Detail:    stbVal,
						DataUtama: map[string]string{"status": status},
					})
				}
			}
		}
	}

	// 3. Search Pengajar
	rowsPengajar, err := config.DB.Query(ctx,
		`SELECT id, nama, status, no_hp
		 FROM pengajar
		 WHERE is_active = true AND (nama ILIKE $1 OR no_hp ILIKE $1)
		 LIMIT 10`, searchTerm)

	if err == nil {
		defer rowsPengajar.Close()
		for rowsPengajar.Next() {
			var id int
			var nama string
			var status, noHP *string
			if err := rowsPengajar.Scan(&id, &nama, &status, &noHP); err == nil {
				detail := ""
				if status != nil {
					detail = *status
				}
				results = append(results, SearchResult{
					Tipe:      "pengajar",
					ID:        id,
					Nama:      nama,
					Detail:    detail,
					DataUtama: map[string]interface{}{"no_hp": noHP, "status": status},
				})
			}
		}
	}

	// 3.5 Search Pengajar Purna (arsip pengajar yang sudah purna tugas)
	rowsPurna, err := config.DB.Query(ctx,
		`SELECT id, nama, status, tahun_keluar
		 FROM pengajar_purna
		 WHERE is_active IS NOT FALSE AND (nama ILIKE $1 OR no_hp ILIKE $1)
		 LIMIT 10`, searchTerm)

	if err == nil {
		defer rowsPurna.Close()
		for rowsPurna.Next() {
			var id int
			var nama string
			var status, tahunKeluar *string
			if err := rowsPurna.Scan(&id, &nama, &status, &tahunKeluar); err == nil {
				detail := "Pengajar purna"
				if tahunKeluar != nil && *tahunKeluar != "" {
					detail += " • keluar " + *tahunKeluar
				}
				if status != nil && *status != "" {
					detail += " • " + *status
				}
				results = append(results, SearchResult{
					Tipe:      "pengajar_purna",
					ID:        id,
					Nama:      nama,
					Detail:    detail,
					DataUtama: map[string]interface{}{"status": status, "tahun_keluar": tahunKeluar},
				})
			}
		}
	}

	// 4. Search Dewan Harian
	rowsDewan, err := config.DB.Query(ctx,
		`SELECT id, nama, jabatan, lembaga
		 FROM dewan_harian
		 WHERE is_active = true AND (nama ILIKE $1 OR jabatan ILIKE $1)
		 LIMIT 10`, searchTerm)

	if err == nil {
		defer rowsDewan.Close()
		for rowsDewan.Next() {
			var id int
			var nama, jabatan, lembaga string
			if err := rowsDewan.Scan(&id, &nama, &jabatan, &lembaga); err == nil {
				results = append(results, SearchResult{
					Tipe:      "dewan_harian",
					ID:        id,
					Nama:      nama,
					Detail:    jabatan + " " + lembaga,
					DataUtama: map[string]interface{}{"jabatan": jabatan, "lembaga": lembaga},
				})
			}
		}
	}

	return results, nil
}

