package models

import (
	"context"
	"fmt"
	"time"

	"github.com/mubtadiaat/app/config"
)

// DataHealthIssue merepresentasikan satu kategori anomali data penilaian.
type DataHealthIssue struct {
	Kode    string   `json:"kode"`
	Judul   string   `json:"judul"`
	Level   string   `json:"level"` // "bahaya" | "perhatian"
	Deskripsi string `json:"deskripsi"`
	Jumlah  int      `json:"jumlah"`
	Nama    []string `json:"nama,omitempty"`
}

// DataHealthReport kumpulan hasil pemeriksaan kesehatan data penilaian.
type DataHealthReport struct {
	TahunAjaran string            `json:"tahun_ajaran"`
	AdaMasalah  bool              `json:"ada_masalah"`
	Issues      []DataHealthIssue `json:"issues"`
}

// maxSample membatasi jumlah nama contoh yang ditampilkan di dashboard.
const maxSample = 8

func sampleNames(rows []string) []string {
	if len(rows) > maxSample {
		return rows[:maxSample]
	}
	return rows
}

// GetDataHealthReport memeriksa anomali data penilaian untuk tahun ajaran aktif.
// Dipanggil dari dashboard pimpinan sebagai "watchdog" internal — bukan cron.
func GetDataHealthReport(ctx context.Context, tahunAjaran string) (DataHealthReport, error) {
	report := DataHealthReport{TahunAjaran: tahunAjaran, Issues: []DataHealthIssue{}}

	// 1. Khos kelas lama yang nyasar: santri SUDAH punya nilai di kelas sekarang
	//    tapi masih ada baris khos dari mapel kelas lama.
	var nKhosLama int
	if err := config.DB.QueryRow(ctx, `
		SELECT COUNT(DISTINCT nk.santri_id)
		FROM nilai_khos nk
		JOIN santri s ON s.id = nk.santri_id
		JOIN bagian b ON b.id = s.bagian_id
		JOIN mata_pelajaran mp ON mp.id = nk.mapel_id
		WHERE nk.tahun_ajaran = $1
		  AND NOT (mp.kelas_id = b.kelas_id AND mp.tingkatan_id = b.tingkatan_id)
		  AND EXISTS (
		    SELECT 1 FROM nilai_kuartal nk4
		    JOIN mata_pelajaran m4 ON m4.id = nk4.mapel_id
		    WHERE nk4.santri_id = nk.santri_id AND nk4.tahun_ajaran = $1
		      AND m4.kelas_id = b.kelas_id AND m4.tingkatan_id = b.tingkatan_id
		  )`, tahunAjaran).Scan(&nKhosLama); err != nil {
		return report, err
	}
	if nKhosLama > 0 {
		var names []string
		rows, _ := config.DB.Query(ctx, `
			SELECT DISTINCT s.nama
			FROM nilai_khos nk JOIN santri s ON s.id=nk.santri_id
			JOIN bagian b ON b.id=s.bagian_id JOIN mata_pelajaran mp ON mp.id=nk.mapel_id
			WHERE nk.tahun_ajaran=$1
			  AND NOT(mp.kelas_id=b.kelas_id AND mp.tingkatan_id=b.tingkatan_id)
			ORDER BY s.nama LIMIT $2`, tahunAjaran, maxSample)
		for rows.Next() {
			var n string
			rows.Scan(&n)
			names = append(names, n)
		}
		rows.Close()
		report.Issues = append(report.Issues, DataHealthIssue{
			Kode: "khos_kelas_lama", Judul: "Nilai kelas lama belum dibersihkan",
			Level: "bahaya", Jumlah: nKhosLama, Nama: sampleNames(names),
			Deskripsi: "Ada santri yang sudah dinilai di kelas sekarang tapi masih punya nilai kelas lama. Jalankan ulang generate nilai.",
		})
	}

	// 2. Santri aktif tanpa Al-Bayan (belum di-generate).
	var nNoBayan int
	var noBayanNames []string
	rows, err := config.DB.Query(ctx, `
		SELECT s.nama FROM santri s
		LEFT JOIN nilai_bayan nb ON nb.santri_id=s.id AND nb.tahun_ajaran=$1
		WHERE s.status='aktif' AND nb.id IS NULL
		ORDER BY s.nama`, tahunAjaran)
	if err != nil {
		return report, err
	}
	for rows.Next() {
		var n string
		rows.Scan(&n)
		noBayanNames = append(noBayanNames, n)
		nNoBayan++
	}
	rows.Close()
	if nNoBayan > 0 {
		report.Issues = append(report.Issues, DataHealthIssue{
			Kode: "bayan_kosong", Judul: "Santri aktif belum punya nilai Al-Bayan",
			Level: "perhatian", Jumlah: nNoBayan, Nama: sampleNames(noBayanNames),
			Deskripsi: "Santri aktif belum di-generate nilai Al-Bayan untuk tahun ajaran ini.",
		})
	}

	// 3. Absensi manual bulanan yang belum ter-mapping semester.
	var nAbsensiNull int
	if err := config.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM absensi_manual_bulanan
		WHERE tahun_ajaran=$1 AND semester IS NULL`, tahunAjaran).Scan(&nAbsensiNull); err != nil {
		return report, err
	}
	if nAbsensiNull > 0 {
		report.Issues = append(report.Issues, DataHealthIssue{
			Kode: "absensi_belum_mapping", Judul: "Absensi manual belum masuk semester",
			Level: "bahaya", Jumlah: nAbsensiNull,
			Deskripsi: "Ada baris absensi manual yang belum ter-mapping ke semester. Cek kalender akademik lalu simpan ulang agar otomatis ter-mapping.",
		})
	}

	// 4. Nilai kuartal dobel lintas kelas (input ganda) — sumber kasus Bayan turun.
	var nDobel int
	rows2, err := config.DB.Query(ctx, `
		SELECT s.nama FROM (
		  SELECT nk.santri_id, COUNT(DISTINCT (mp.kelas_id, mp.tingkatan_id)) AS kelas
		  FROM nilai_kuartal nk JOIN mata_pelajaran mp ON mp.id=nk.mapel_id
		  WHERE nk.tahun_ajaran=$1 GROUP BY nk.santri_id
		  HAVING COUNT(DISTINCT (mp.kelas_id, mp.tingkatan_id)) > 1
		) d JOIN santri s ON s.id=d.santri_id ORDER BY s.nama`, tahunAjaran)
	if err != nil {
		return report, err
	}
	var dobelNames []string
	for rows2.Next() {
		var n string
		rows2.Scan(&n)
		dobelNames = append(dobelNames, n)
		nDobel++
	}
	rows2.Close()
	if nDobel > 0 {
		report.Issues = append(report.Issues, DataHealthIssue{
			Kode: "nilai_dobel_kelas", Judul: "Nilai kuartal terinput di lebih dari satu kelas",
			Level: "perhatian", Jumlah: nDobel, Nama: sampleNames(dobelNames),
			Deskripsi: "Santri ini punya nilai kuartal di 2+ kelas pada TA yang sama. Sistem memakai kelas sekarang; kelas lama diabaikan sebagai arsip.",
		})
	}

	// ── Watchdog pergantian tahun ajaran (semua penanggalan TETAP manual;
	//    fungsi ini hanya "lampu merah" bila ada yang terlewat).
	if err := cekPergantianTahun(ctx, &report); err != nil {
		return report, err
	}

	report.AdaMasalah = len(report.Issues) > 0
	return report, nil
}

// cekPergantianTahun menambahkan issue bila:
//   R1 (bahaya)    — tanggal hari ini sudah TA baru tapi settings belum diganti
//   R2 (perhatian) — hari ini jatuh di lubang/gap antar rentang kuartal
//   R3 (perhatian) — TA depan mulai <=90 hari lagi tapi penugasan masih kosong
//   R4 (perhatian) — pengingat manual Hijri: settings hilang / semester Hijri belum diisi
//
// Gaya-1 (manual + lampu merah): admin tetap yang memutuskan; di sini hanya
// memastikan keputusan itu tidak terlewat tanpa sadar.
func cekPergantianTahun(ctx context.Context, report *DataHealthReport) error {
	// R1 — TA menurut tanggal hari ini (kalender) vs pin settings.
	var taTgl, taSet *string
	_ = config.DB.QueryRow(ctx,
		`SELECT tahun_ajaran FROM kalender_kuartal
		  WHERE CURRENT_DATE BETWEEN tgl_mulai AND tgl_selesai LIMIT 1`).Scan(&taTgl)
	_ = config.DB.QueryRow(ctx,
		`SELECT value FROM settings WHERE key='tahun_ajaran_aktif' AND value <> ''`).Scan(&taSet)

	var adaKalender bool
	_ = config.DB.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM kalender_kuartal)").Scan(&adaKalender)

	switch {
	case taTgl != nil && (taSet == nil || *taSet != *taTgl):
		aktif := "(belum di-set)"
		if taSet != nil {
			aktif = *taSet
		}
		report.Issues = append(report.Issues, DataHealthIssue{
			Kode:    "rollover-ta",
			Judul:   "Tahun ajaran settings belum diganti",
			Level:   "bahaya",
			Deskripsi: fmt.Sprintf("Tanggal hari ini masuk TA %s menurut kalender, tapi settings masih %s. Absensi/jadwal/penugasan tetap menulis ke TA lama — ganti TA di Settings sebelum data nambah salah.", *taTgl, aktif),
			Jumlah:  1,
		})
	case taTgl == nil && adaKalender:
		// R2 — gap. TA aktif berkuasa dari settings; cukup peringatan lembut.
		report.Issues = append(report.Issues, DataHealthIssue{
			Kode:    "kalender-gap",
			Judul:   "Hari ini di luar rentang kuartal (lubang kalender)",
			Level:   "perhatian",
			Deskripsi: fmt.Sprintf("TA aktif mengikuti settings: %s. Wajar kalau memang libur semester — coba cocokkan dengan kalender kuartal yang terisi.", GetTahunAjaranAktif(ctx)),
			Jumlah:  1,
		})
	}

	// R3 — penugasan TA depan (mulai <= 90 hari) masih kosong.
	aktif := GetTahunAjaranAktif(ctx)
	var depan string
	var mulai time.Time
	if err := config.DB.QueryRow(ctx,
		`SELECT tahun_ajaran, MIN(tgl_mulai) FROM kalender_kuartal
		  WHERE tgl_mulai > CURRENT_DATE AND tahun_ajaran <> $1
		  GROUP BY tahun_ajaran ORDER BY MIN(tgl_mulai) LIMIT 1`, aktif).Scan(&depan, &mulai); err == nil {
		if sisa := time.Until(mulai); sisa <= 90*24*time.Hour {
			var n int
			_ = config.DB.QueryRow(ctx,
				`SELECT (SELECT COUNT(*) FROM mustahiq_bagian WHERE tahun_ajaran=$1)
				      + (SELECT COUNT(*) FROM pengajar_bagian WHERE tahun_ajaran=$1)`,
				depan).Scan(&n)
			if n == 0 {
				report.Issues = append(report.Issues, DataHealthIssue{
					Kode:    "penugasan-depan",
					Judul:   fmt.Sprintf("Penugasan TA %s belum ada", depan),
					Level:   "perhatian",
					Deskripsi: fmt.Sprintf("TA itu mulai %s (kurang dari 90 hari) tapi belum ada mustahiq/munawwib terdaftar — kalau dilewati, jadwal & penilaian TA baru kosong semua.", mulai.Format("02 Jan 2006")),
					Jumlah:  1,
				})
			}
		}
	}

	// R4 — pengingat manual Hijri (gak ada kalkulasi otomatis di sistem ini).
	var nSemester int
	_ = config.DB.QueryRow(ctx, "SELECT COUNT(*) FROM kalender_semester_hijri").Scan(&nSemester)
	var hijriOK bool
	_ = config.DB.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM settings WHERE key='tahun_hijri_aktif' AND value <> '')`).Scan(&hijriOK)
	if nSemester == 0 || !hijriOK {
		var sebab string
		switch {
		case nSemester == 0 && !hijriOK:
			sebab = "tahun Hijri di settings hilang dan kalender semester Hijri masih kosong"
		case nSemester == 0:
			sebab = "kalender semester Hijri masih kosong"
		default:
			sebab = "tahun Hijri di settings hilang"
		}
		report.Issues = append(report.Issues, DataHealthIssue{
			Kode:      "hijri-manual",
			Judul:   "Kalender Hijri perlu diisi manual",
			Level:     "perhatian",
			Deskripsi: fmt.Sprintf("Sistem tidak menghitung bulan Hijri sendiri (ruk'yah manual), tapi %s. Isi di Settings/Kalender bila memang belum.", sebab),
			Jumlah:    1,
		})
	}

	return nil
}
