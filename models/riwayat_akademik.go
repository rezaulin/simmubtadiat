package models

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/mubtadiaat/app/config"
)

type RiwayatAbsensi struct {
	Bulan      string `json:"bulan"`       // e.g. "Muharram"
	BulanAngka int    `json:"bulan_angka"` // 1-12 (Hijriyah)
	Sakit      int    `json:"s"`
	Izin       int    `json:"i"`
	TanpaKet   int    `json:"t"`
}

type RiwayatRaport struct {
	NamaMapel string  `json:"mapel"`
	// Nilai Raport (Khos) per semester — hasil olahan tamrin+ujian
	Smt1 *string `json:"smt1"` // Raport semester 1 (Nilai Khos)
	Smt2 *string `json:"smt2"` // Raport semester 2 (Nilai Khos)
	// Nilai mentah per kuartal (untuk tampilan lengkap di detail santri)
	TamrinK1 *string `json:"tamrin_k1"` // Kuartal 1 = tamrin semester 1
	UjianK2  *string `json:"ujian_k2"`  // Kuartal 2 = ujian semester 1
	TamrinK3 *string `json:"tamrin_k3"` // Kuartal 3 = tamrin semester 2
	UjianK4  *string `json:"ujian_k4"`  // Kuartal 4 = ujian semester 2
}

type RiwayatAkademikTahun struct {
	TahunAjaran string           `json:"tahun_ajaran"`
	NamaBagian  string           `json:"nama_bagian"`
	Absensi     []RiwayatAbsensi `json:"absensi"`
	Raport      []RiwayatRaport  `json:"raport"`
	AlBayan     *string          `json:"al_bayan"`
}

func GetRiwayatAkademik(ctx context.Context, santriID int) ([]RiwayatAkademikTahun, error) {
	// Riwayat dikunci berdasarkan TAHUN AJARAN sebenarnya, dan daftar tahunnya
	// dikumpulkan dari GABUNGAN sumber (nilai khos + absensi + riwayat bagian)
	// sehingga tak ada data yang tercecer/hilang — penting untuk alumni yang
	// riwayatnya membentang beberapa tahun. Data ini tetap ada setelah lulus.

	// 1. Muat rentang kalender per kuartal + hitung rentang keseluruhan per TA.
	type kalRange struct {
		TA    string
		Start time.Time
		End   time.Time
	}
	var kalRanges []kalRange
	taBounds := map[string]*struct {
		Min time.Time
		Max time.Time
	}{}
	if rowsKal, err := config.DB.Query(ctx, "SELECT tahun_ajaran, tgl_mulai, tgl_selesai FROM kalender_kuartal"); err == nil {
		for rowsKal.Next() {
			var r kalRange
			if err := rowsKal.Scan(&r.TA, &r.Start, &r.End); err == nil {
				kalRanges = append(kalRanges, r)
				b, ok := taBounds[r.TA]
				if !ok {
					taBounds[r.TA] = &struct {
						Min time.Time
						Max time.Time
					}{r.Start, r.End}
				} else {
					if r.Start.Before(b.Min) {
						b.Min = r.Start
					}
					if r.End.After(b.Max) {
						b.Max = r.End
					}
				}
			}
		}
		rowsKal.Close()
	}

	// findTA memetakan sebuah tanggal ke tahun ajaran berdasarkan rentang kuartal.
	findTA := func(t time.Time) string {
		for _, k := range kalRanges {
			if (t.After(k.Start) || t.Equal(k.Start)) && (t.Before(k.End) || t.Equal(k.End)) {
				return k.TA
			}
		}
		return ""
	}

	// deriveTAHeuristik memperkirakan tahun ajaran dari sebuah tanggal tanpa
	// bergantung pada kalender_kuartal (yang mungkin belum diisi). Konvensi:
	// tahun ajaran dimulai bulan Juli. Dipakai sebagai fallback pemetaan
	// riwayat_bagian → TA agar label kelas tetap muncul.
	deriveTAHeuristik := func(t time.Time) string {
		y := t.Year()
		if int(t.Month()) >= 7 {
			return fmt.Sprintf("%d/%d", y, y+1)
		}
		return fmt.Sprintf("%d/%d", y-1, y)
	}

	// Himpunan tahun ajaran (urut) yang akan ditampilkan.
	taSet := map[string]bool{}
	addTA := func(ta string) {
		if ta != "" {
			taSet[ta] = true
		}
	}

	// 2. Raport (Nilai Khos) — TA diambil langsung dari kolom tersimpan.
	type rawRaport struct {
		TA       string
		Mapel    string
		Semester int
		Nilai    string
	}
	var raports []rawRaport
	// Kirim NAMA KITAB (Arab) apa adanya. Frontend akan mentranslasi ke
	// ejaan Latin/Indonesia via modul kitab-translate.js. Kalau nama_kitab
	// kosong, gunakan nama_mapel sebagai fallback.
	if rowsRaport, err := config.DB.Query(ctx, `
		SELECT n.tahun_ajaran, COALESCE(NULLIF(m.nama_kitab, ''), m.nama_mapel), n.semester, n.nilai_akhir
		FROM nilai_khos n
		JOIN mata_pelajaran m ON n.mapel_id = m.id
		WHERE n.santri_id = $1`, santriID); err == nil {
		for rowsRaport.Next() {
			var r rawRaport
			var nilai float64
			if err := rowsRaport.Scan(&r.TA, &r.Mapel, &r.Semester, &nilai); err == nil {
				r.Nilai = fmt.Sprintf("%v", nilai)
				raports = append(raports, r)
				addTA(r.TA)
			}
		}
		rowsRaport.Close()
	} else {
		return nil, err
	}

	// 2b. Nilai per Kuartal (Tamrin K1/K3, Ujian K2/K4) — untuk detail lengkap.
	type rawKuartal struct {
		TA      string
		Mapel   string
		Kuartal int
		Nilai   string
	}
	var kuartals []rawKuartal
	if rowsK, err := config.DB.Query(ctx, `
		SELECT nk.tahun_ajaran, COALESCE(NULLIF(m.nama_kitab, ''), m.nama_mapel), nk.kuartal, nk.nilai
		FROM nilai_kuartal nk
		JOIN mata_pelajaran m ON nk.mapel_id = m.id
		WHERE nk.santri_id = $1`, santriID); err == nil {
		for rowsK.Next() {
			var r rawKuartal
			var nilai float64
			if err := rowsK.Scan(&r.TA, &r.Mapel, &r.Kuartal, &nilai); err == nil {
				r.Nilai = fmt.Sprintf("%v", nilai)
				kuartals = append(kuartals, r)
				addTA(r.TA)
			}
		}
		rowsK.Close()
	}

	// 3. Absensi — dari absensi_manual_bulanan (bulan Hijriyah, satuan hari).
	//    Juga gabungkan data dari absensi_perizinan (ustadz, satuan pertemuan→hari).
	type rawAbsensiManual struct {
		BulanHijri int
		TahunHijri int
		Sakit      int
		Izin       int
		Alpha      int
		TA         string
	}
	var absensisManual []rawAbsensiManual
	if rowsAM, err := config.DB.Query(ctx, `
		SELECT bulan_hijri, tahun_hijri, total_sakit, total_izin, total_alpha, tahun_ajaran
		FROM absensi_manual_bulanan WHERE santri_id = $1`, santriID); err == nil {
		for rowsAM.Next() {
			var r rawAbsensiManual
			if err := rowsAM.Scan(&r.BulanHijri, &r.TahunHijri, &r.Sakit, &r.Izin, &r.Alpha, &r.TA); err == nil {
				absensisManual = append(absensisManual, r)
				addTA(r.TA)
			}
		}
		rowsAM.Close()
	}

	// 3.5 Al-Bayan
	type rawBayan struct {
		TA    string
		Label string
	}
	var bayans []rawBayan
	if rowsBayan, err := config.DB.Query(ctx, `
		SELECT tahun_ajaran, label_arab
		FROM nilai_bayan WHERE santri_id = $1`, santriID); err == nil {
		for rowsBayan.Next() {
			var r rawBayan
			if err := rowsBayan.Scan(&r.TA, &r.Label); err == nil {
				bayans = append(bayans, r)
			}
		}
		rowsBayan.Close()
	}

	bulanHijriNames := []string{"", "Muharram", "Safar", "Rabiul Awal", "Rabiul Akhir", "Jumadil Awal", "Jumadil Akhir", "Rajab", "Sya'ban", "Ramadhan", "Syawwal", "Dzulqa'dah", "Dzulhijjah"}

	// 4. Riwayat penempatan bagian (untuk label bagian per tahun).
	type rbRow struct {
		Bagian  string
		Mulai   time.Time
		Selesai *time.Time
	}
	var rbRows []rbRow
	// Bangun label kelas lengkap: "Tingkatan Kelas - Bagian" (misal "Aliyah 3 - Bagian A1").
	// Ini yang akan dipakai sebagai header kartu Riwayat Akademik.
	if rowsRB, err := config.DB.Query(ctx, `
		SELECT
			COALESCE(t.nama, '') || CASE WHEN COALESCE(k.nama,'') <> '' THEN ' ' || k.nama ELSE '' END
				|| CASE WHEN COALESCE(b.nama_bagian,'') <> '' THEN ' - Bagian ' || b.nama_bagian ELSE '' END AS label,
			r.tanggal_mulai, r.tanggal_selesai
		FROM riwayat_bagian r
		JOIN bagian b ON r.bagian_id = b.id
		LEFT JOIN kelas k ON b.kelas_id = k.id
		LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		WHERE r.santri_id = $1
		ORDER BY r.tanggal_mulai DESC`, santriID); err == nil {
		for rowsRB.Next() {
			var rb rbRow
			if err := rowsRB.Scan(&rb.Bagian, &rb.Mulai, &rb.Selesai); err == nil {
				rbRows = append(rbRows, rb)
				addTA(findTA(rb.Mulai))
			}
		}
		rowsRB.Close()
	} else {
		return nil, err
	}

	// 5. Urutkan TA menurun (format "YYYY/YYYY" aman diurutkan sebagai string).
	var taList []string
	for ta := range taSet {
		taList = append(taList, ta)
	}
	sort.Sort(sort.Reverse(sort.StringSlice(taList)))
	latestTA := ""
	if len(taList) > 0 {
		latestTA = taList[0]
	}

	// bagianForTA memilih nama bagian untuk sebuah TA. Urutan strategi:
	//   1. Irisan rentang tanggal [mulai, selesai] dengan rentang TA (kalender).
	//   2. TA dari tanggal mulai via kalender (findTA).
	//   3. TA dari tanggal mulai via heuristik (tanpa kalender).
	//   4. Untuk TA terkini, pakai penempatan terbaru (rbRows[0]) sebagai
	//      fallback terakhir agar label kelas tak kosong ("-").
	bagianForTA := func(ta string) string {
		if b, ok := taBounds[ta]; ok {
			for _, rb := range rbRows { // sudah urut mulai DESC
				selesai := rb.Mulai
				if rb.Selesai != nil {
					selesai = *rb.Selesai
				} else {
					selesai = time.Now().AddDate(100, 0, 0) // masih aktif
				}
				if !rb.Mulai.After(b.Max) && !selesai.Before(b.Min) {
					return rb.Bagian
				}
			}
		}
		// Fallback 2: baris yang tanggal mulainya jatuh pada TA tsb (kalender).
		for _, rb := range rbRows {
			if findTA(rb.Mulai) == ta {
				return rb.Bagian
			}
		}
		// Fallback 3: heuristik TA (tanpa kalender_kuartal).
		for _, rb := range rbRows {
			if deriveTAHeuristik(rb.Mulai) == ta {
				return rb.Bagian
			}
		}
		// Fallback 4: untuk TA terkini, tampilkan penempatan terbaru.
		if ta == latestTA && len(rbRows) > 0 {
			return rbRows[0].Bagian
		}
		return ""
	}

	// 6. Susun hasil per TA.
	result := make([]RiwayatAkademikTahun, 0, len(taList))
	for _, ta := range taList {
		var alBayan *string
		for _, b := range bayans {
			if b.TA == ta {
				alBayan = &b.Label
				break
			}
		}

		rat := RiwayatAkademikTahun{
			TahunAjaran: ta,
			NamaBagian:  bagianForTA(ta),
			Absensi:     make([]RiwayatAbsensi, 0),
			Raport:      make([]RiwayatRaport, 0),
			AlBayan:     alBayan,
		}

		// Raport per mapel (Nilai Khos).
		mapelMap := make(map[string]*RiwayatRaport)
		var mapelOrder []string
		for _, r := range raports {
			if r.TA != ta {
				continue
			}
			m, ok := mapelMap[r.Mapel]
			if !ok {
				m = &RiwayatRaport{NamaMapel: r.Mapel}
				mapelMap[r.Mapel] = m
				mapelOrder = append(mapelOrder, r.Mapel)
			}
			val := r.Nilai
			if r.Semester == 1 {
				m.Smt1 = &val
			} else if r.Semester == 2 {
				m.Smt2 = &val
			}
		}

		// Nilai per Kuartal (Tamrin K1/K3, Ujian K2/K4).
		for _, k := range kuartals {
			if k.TA != ta {
				continue
			}
			m, ok := mapelMap[k.Mapel]
			if !ok {
				m = &RiwayatRaport{NamaMapel: k.Mapel}
				mapelMap[k.Mapel] = m
				mapelOrder = append(mapelOrder, k.Mapel)
			}
			val := k.Nilai
			switch k.Kuartal {
			case 1:
				m.TamrinK1 = &val
			case 2:
				m.UjianK2 = &val
			case 3:
				m.TamrinK3 = &val
			case 4:
				m.UjianK4 = &val
			}
		}
		for _, name := range mapelOrder {
			rat.Raport = append(rat.Raport, *mapelMap[name])
		}

		// Absensi per bulan Hijriyah (langsung hari dari absensi_manual_bulanan).
		abMap := make(map[int]*RiwayatAbsensi)
		for _, a := range absensisManual {
			if a.TA != ta {
				continue
			}
			m, ok := abMap[a.BulanHijri]
			if !ok {
				nama := ""
				if a.BulanHijri >= 1 && a.BulanHijri <= 12 {
					nama = bulanHijriNames[a.BulanHijri]
				}
				m = &RiwayatAbsensi{Bulan: nama, BulanAngka: a.BulanHijri}
				abMap[a.BulanHijri] = m
			}
			m.Sakit += a.Sakit
			m.Izin += a.Izin
			m.TanpaKet += a.Alpha
		}
		// Urutkan bulan.
		var bulanKeys []int
		for k := range abMap {
			bulanKeys = append(bulanKeys, k)
		}
		sort.Ints(bulanKeys)
		for _, k := range bulanKeys {
			rat.Absensi = append(rat.Absensi, *abMap[k])
		}

		result = append(result, rat)
	}

	return result, nil
}
