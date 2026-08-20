package models

import (
	"context"
	"strconv"
	"time"

	"github.com/mubtadiaat/app/config"
)

type ProsesKeluarInput struct {
	SantriID         int    `json:"santri_id"`
	StatusAkhir      string `json:"status_akhir"` // lulus, boyong, keluar
	TanggalKeluar    string `json:"tanggal_keluar"`
	Alasan           string `json:"alasan"`
	KeteranganAlumni string `json:"keterangan_alumni"` // alasan tidak khidmah, dll
}

// ProsesKeluarSantri handles the graduation or exiting of a student
func ProsesKeluarSantri(ctx context.Context, input ProsesKeluarInput) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 0. Koersi Kelas_Akhir: santri yang telah menuntaskan Kelas 3 Aliyah dan
	// diproses "boyong" diperlakukan sebagai alumni lulus (Requirement 4.3).
	// Status lain (lulus/keluar) dan santri belum Kelas_Akhir tidak berubah.
	statusAkhir := input.StatusAkhir
	isAkhir, err := GetKelasAkhirStatus(ctx, tx, input.SantriID)
	if err != nil {
		return err
	}
	statusAkhir = resolveStatusKeluar(statusAkhir, isAkhir)

	// 1. Update status di tabel santri sekaligus lepaskan dari bagian/kelas.
	// Set tahun_keluar otomatis dari tanggal keluar (kolom dari migrasi 029).
	// tanggal_status juga diisi agar tanggal perubahan status tampil di Arsip.
	var ta string
	_ = tx.QueryRow(ctx, "SELECT tahun_ajaran FROM kalender_kuartal WHERE $1::DATE BETWEEN tgl_mulai AND tgl_selesai LIMIT 1", input.TanggalKeluar).Scan(&ta)
	if ta == "" {
		_ = tx.QueryRow(ctx, "SELECT tahun_ajaran FROM kalender_kuartal ORDER BY tgl_selesai DESC LIMIT 1").Scan(&ta)
	}

	_, err = tx.Exec(ctx,
		`UPDATE santri SET status = $1, last_bagian_id = COALESCE(bagian_id, last_bagian_id), last_tahun_ajaran = COALESCE(NULLIF($4, ''), last_tahun_ajaran), bagian_id = NULL, tanggal_status = $2::DATE, tahun_keluar = EXTRACT(YEAR FROM $2::DATE)::TEXT WHERE id = $3`,
		statusAkhir, input.TanggalKeluar, input.SantriID, ta)
	if err != nil {
		return err
	}

	// 2. Tutup riwayat kelas terakhir
	_, err = tx.Exec(ctx,
		`UPDATE riwayat_bagian 
		 SET tanggal_selesai = $1 
		 WHERE santri_id = $2 AND tanggal_selesai IS NULL`, input.TanggalKeluar, input.SantriID)
	if err != nil {
		return err
	}

	// 3. Catat ke tabel proses_keluar
	_, err = tx.Exec(ctx,
		`INSERT INTO proses_keluar (santri_id, tanggal_keluar, alasan, status_keluar) 
		 VALUES ($1, $2, $3, $4)`, input.SantriID, input.TanggalKeluar, input.Alasan, statusAkhir)
	if err != nil {
		return err
	}

	// 4. Catat otomatis ke tabel alumni untuk arsip (semua status: lulus, boyong, keluar)
	if statusAkhir == "lulus" || statusAkhir == "boyong" || statusAkhir == "keluar" {
		// Gunakan tahun saat ini sebagai tahun lulus sementara
		tahunLulus := time.Now().Format("2006")

		// Tentukan status khidmah:
		// Kalau santri Kelas_Akhir dan langsung lulus (bukan via pengabdian), tandai "tidak_khidmah".
		khidmahStatus := "belum"
		if isAkhir && statusAkhir == "lulus" {
			khidmahStatus = "tidak_khidmah"
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO alumni (santri_id, tahun_lulus, khidmah) 
			 VALUES ($1, $2, $3)
			 ON CONFLICT (santri_id) DO UPDATE SET
			   khidmah = EXCLUDED.khidmah,
			   updated_at = CURRENT_TIMESTAMP`,
			input.SantriID, tahunLulus, khidmahStatus)
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Best-effort: simpan keterangan alumni di luar transaksi (kolom dari migrasi 030).
	keterangan := input.KeteranganAlumni
	if isAkhir && statusAkhir == "lulus" && keterangan == "" {
		keterangan = "Tidak Khidmah"
	}
	if keterangan != "" {
		_, _ = config.DB.Exec(ctx,
			`UPDATE alumni SET keterangan = $1 WHERE santri_id = $2`, keterangan, input.SantriID)
	}

	return nil
}

func UpdateAlumniDetail(ctx context.Context, santriID int, statusIjazah, noIjazah, khidmah, keterangan, asalDaerah, tingkatanAkhir, alasanIjazah string) error {
	_, err := config.DB.Exec(ctx,
		`UPDATE alumni 
		 SET status_ijazah = $1, no_ijazah = $2, khidmah = $3, keterangan = $4,
		 asal_daerah = NULLIF($5, ''), tingkatan_akhir = NULLIF($6, ''), alasan_ijazah_belum_diambil = NULLIF($7, ''),
		 updated_at = CURRENT_TIMESTAMP 
		 WHERE santri_id = $8`, statusIjazah, noIjazah, khidmah, keterangan, asalDaerah, tingkatanAkhir, alasanIjazah, santriID)
	return err
}

// AlumniBiodataInput menampung biodata inti alumni yang dapat dikoreksi admin.
// Biodata ini sebenarnya tersimpan di tabel santri (alumni = join santri+alumni).
type AlumniBiodataInput struct {
	Nama          string
	TTLTempat     string
	TTLTanggal    *time.Time
	NamaWali      string
	NoHP          string
	Alamat        string
	Kamar         string
	TahunMasuk    string
	TahunKeluar   string
	KhidmahTempat string
}

// UpdateAlumniBiodata memperbarui biodata inti alumni di tabel santri sehingga
// admin dapat mengoreksi data yang salah langsung dari halaman Alumni.
// String kosong disimpan sebagai NULL agar tidak menimpa dengan nilai kosong
// yang tak berarti (kecuali nama yang wajib, dijaga di handler).
func UpdateAlumniBiodata(ctx context.Context, santriID int, b AlumniBiodataInput) error {
	nullif := func(s string) interface{} {
		if s == "" {
			return nil
		}
		return s
	}
	_, err := config.DB.Exec(ctx,
		`UPDATE santri SET
			nama = $1,
			ttl_tempat = $2,
			ttl_tanggal = $3,
			nama_wali = $4,
			no_hp_wali = $5,
			alamat = $6,
			kamar = $7,
			tahun_masuk = $8,
			tahun_keluar = $9,
			khidmah_tempat = $10,
			updated_at = CURRENT_TIMESTAMP
		 WHERE id = $11`,
		b.Nama, nullif(b.TTLTempat), b.TTLTanggal, nullif(b.NamaWali), nullif(b.NoHP),
		nullif(b.Alamat), nullif(b.Kamar), nullif(b.TahunMasuk), nullif(b.TahunKeluar),
		nullif(b.KhidmahTempat), santriID)
	return err
}

type AlumniResponse struct {
	SantriID       int     `json:"santri_id"`
	Nama           string  `json:"nama"`
	Stambuk        string  `json:"stambuk"`
	NISN           *string `json:"nisn"`
	TTL            *string    `json:"ttl"`
	TTLTanggal     *time.Time `json:"ttl_tanggal"`
	NamaWali       *string    `json:"nama_wali"`
	Alamat         *string `json:"alamat"`
	NoHP           *string `json:"no_hp_wali"`
	StatusIjazah   string  `json:"status_ijazah"`
	NoIjazah       string  `json:"no_ijazah"`
	Khidmah        string  `json:"khidmah"`
	TempatKhidmah  *string `json:"tempat_khidmah"`
	Keterangan     string  `json:"keterangan"`
	TingkatanAkhir string  `json:"tingkatan_akhir"`
	StatusAkhir    string  `json:"status_akhir"`
	AsalDaerah     string  `json:"asal_daerah"`
	ProvinsiKode   *string `json:"provinsi_kode"`
	ProvinsiNama   *string `json:"provinsi_nama"`
	KabupatenKode  *string `json:"kabupaten_kode"`
	KabupatenNama  *string `json:"kabupaten_nama"`
	TahunMasuk     *string `json:"tahun_masuk"`
	TahunKeluar    *string `json:"tahun_keluar"`
	Kamar          *string `json:"kamar"`
	AlasanIjazah   *string `json:"alasan_ijazah_belum_diambil"`
}

// AlumniFilter berisi filter opsional untuk daftar alumni.
type AlumniFilter struct {
	StatusAkhir   string
	ProvinsiKode  string
	KabupatenKode string
}

func GetAllAlumni(ctx context.Context, filter AlumniFilter) ([]AlumniResponse, error) {
	query := `SELECT a.santri_id, s.nama, COALESCE(s.stambuk, ''), s.nisn,
			  s.ttl_tempat, s.ttl_tanggal, s.nama_wali, s.alamat, s.no_hp_wali, s.khidmah_tempat,
			  a.status_ijazah, a.no_ijazah, a.khidmah, a.keterangan, s.status,
			  s.provinsi_kode, s.provinsi_nama, s.kabupaten_kode, s.kabupaten_nama,
			  s.tahun_masuk, s.tahun_keluar, s.kamar,
			  COALESCE(a.tingkatan_akhir, (
				SELECT TRIM(COALESCE(t.nama, '') || ' ' || COALESCE(k.nama, ''))
				FROM riwayat_bagian rb
				JOIN bagian b ON rb.bagian_id = b.id
				LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
				LEFT JOIN kelas k ON b.kelas_id = k.id
				WHERE rb.santri_id = s.id
				ORDER BY rb.tanggal_mulai DESC NULLS LAST, rb.id DESC
				LIMIT 1
			  )) AS tingkatan_akhir,
			  COALESCE(a.asal_daerah, NULLIF(TRIM(COALESCE(s.kabupaten_nama, '') || CASE WHEN s.kabupaten_nama IS NOT NULL AND s.provinsi_nama IS NOT NULL THEN ', ' ELSE '' END || COALESCE(s.provinsi_nama, '')), '')) AS asal_daerah,
			  a.alasan_ijazah_belum_diambil
			  FROM alumni a
			  JOIN santri s ON a.santri_id = s.id
			  WHERE 1=1`
	args := []interface{}{}
	if filter.StatusAkhir != "" {
		query += " AND s.status = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.StatusAkhir)
	}
	if filter.ProvinsiKode != "" {
		query += " AND s.provinsi_kode = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.ProvinsiKode)
	}
	if filter.KabupatenKode != "" {
		query += " AND s.kabupaten_kode = $" + strconv.Itoa(len(args)+1)
		args = append(args, filter.KabupatenKode)
	}
	query += " ORDER BY s.nama ASC"

	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := []AlumniResponse{}
	for rows.Next() {
		var a AlumniResponse
		var noIj, khid, keterangan, tingkatanAkhir, asalDaerah, alasanIjazah *string
		if err := rows.Scan(&a.SantriID, &a.Nama, &a.Stambuk, &a.NISN,
			&a.TTL, &a.TTLTanggal, &a.NamaWali, &a.Alamat, &a.NoHP, &a.TempatKhidmah,
			&a.StatusIjazah, &noIj, &khid, &keterangan, &a.StatusAkhir,
			&a.ProvinsiKode, &a.ProvinsiNama, &a.KabupatenKode, &a.KabupatenNama,
			&a.TahunMasuk, &a.TahunKeluar, &a.Kamar, &tingkatanAkhir, &asalDaerah, &alasanIjazah); err != nil {
			return nil, err
		}
		if noIj != nil {
			a.NoIjazah = *noIj
		}
		if khid != nil {
			a.Khidmah = *khid
		}
		if keterangan != nil {
			a.Keterangan = *keterangan
		}
		if tingkatanAkhir != nil {
			a.TingkatanAkhir = *tingkatanAkhir
		} else {
			a.TingkatanAkhir = "-"
		}
		
		if asalDaerah != nil && *asalDaerah != "" {
			a.AsalDaerah = *asalDaerah
		} else {
			a.AsalDaerah = buildAsalDaerah(a.KabupatenNama, a.ProvinsiNama, a.Alamat)
		}

		a.AlasanIjazah = alasanIjazah

		res = append(res, a)
	}
	return res, nil
}

// buildAsalDaerah menyusun teks asal daerah dari data wilayah berjenjang, dengan
// fallback ke alamat bebas ketika wilayah belum diisi.
func buildAsalDaerah(kabupaten, provinsi, alamat *string) string {
	parts := []string{}
	if kabupaten != nil && *kabupaten != "" {
		parts = append(parts, *kabupaten)
	}
	if provinsi != nil && *provinsi != "" {
		parts = append(parts, *provinsi)
	}
	if len(parts) > 0 {
		out := parts[0]
		for i := 1; i < len(parts); i++ {
			out += ", " + parts[i]
		}
		return out
	}
	if alamat != nil && *alamat != "" {
		return *alamat
	}
	return "-"
}

// TambahAlumniManual menambahkan satu alumni secara manual (tanpa proses keluar).
// Insert ke tabel santri (status=lulus) + tabel alumni.
func TambahAlumniManual(ctx context.Context, nama, stambuk, nisn, ttl, wali, alamat, noHP, khidmah, tempatKhidmah, statusIjazah, keterangan, tahunMasuk, tahunKeluar string) error {
	// Generate NIK placeholder
	nik := "ALM_" + stambuk + "_" + time.Now().Format("20060102150405")

	var santriID int
	err := config.DB.QueryRow(ctx,
		`INSERT INTO santri (nik, stambuk, nisn, nama, nama_wali, ttl_tempat, alamat, no_hp_wali,
		   status, khidmah_tempat, tahun_masuk, tahun_keluar)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'lulus', $9, $10, $11)
		 ON CONFLICT (stambuk) DO UPDATE SET
		   nisn = COALESCE(EXCLUDED.nisn, santri.nisn),
		   nama_wali = COALESCE(EXCLUDED.nama_wali, santri.nama_wali),
		   tahun_masuk = COALESCE(EXCLUDED.tahun_masuk, santri.tahun_masuk),
		   tahun_keluar = COALESCE(EXCLUDED.tahun_keluar, santri.tahun_keluar)
		 RETURNING id`,
		nik, stambuk, nilIfEmpty2(nisn), nama, nilIfEmpty2(wali), nilIfEmpty2(ttl),
		nilIfEmpty2(alamat), nilIfEmpty2(noHP), nilIfEmpty2(tempatKhidmah),
		nilIfEmpty2(tahunMasuk), nilIfEmpty2(tahunKeluar)).Scan(&santriID)
	if err != nil {
		return err
	}

	// Insert alumni record
	_, err = config.DB.Exec(ctx,
		`INSERT INTO alumni (santri_id, tahun_lulus, khidmah, status_ijazah, keterangan)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (santri_id) DO UPDATE SET
		   khidmah = EXCLUDED.khidmah, status_ijazah = EXCLUDED.status_ijazah,
		   keterangan = EXCLUDED.keterangan, updated_at = CURRENT_TIMESTAMP`,
		santriID, nilIfEmpty2(tahunKeluar), khidmah, statusIjazah, nilIfEmpty2(keterangan))
	return err
}

func nilIfEmpty2(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
