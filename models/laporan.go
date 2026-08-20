package models

import (
	"context"
	"fmt"
	"strings"

	"github.com/mubtadiaat/app/config"
)

type RaportSettings struct {
	ID                   int    `json:"id"`
	HeaderBaris1         string `json:"header_baris_1"`
	HeaderBaris2         string `json:"header_baris_2"`
	HeaderBaris3         string `json:"header_baris_3"`
	NamaKepala           string `json:"nama_kepala"`
	NIPKepala            string `json:"nip_kepala"`
	LogoURL              string `json:"logo_url"`
	UrutanKolomIdentitas string `json:"urutan_kolom_identitas"`
}

type RaportData struct {
	Santri        map[string]interface{}   `json:"santri"`
	Settings      RaportSettings           `json:"settings"`
	Nilai         []map[string]interface{} `json:"nilai"`
	Absensi       map[string]interface{}   `json:"absensi"`
	NilaiAm       *float64                 `json:"nilai_am"`
	Bayan         string                   `json:"bayan"`
	BagianNama    string                   `json:"bagian_nama"`
	KelasNama     string                   `json:"kelas_nama"`
	TingkatanNama string                   `json:"tingkatan_nama"`
	NamaMudarris  string                   `json:"nama_mudarris"`
	NamaMudir     string                   `json:"nama_mudir"`
	TtdMudir      string                   `json:"tanda_tangan_mudir"`
	TahunAjaran   string                   `json:"tahun_ajaran"`
}

type MudirTingkatan struct {
	TingkatanID   int    `json:"tingkatan_id"`
	TingkatanNama string `json:"tingkatan_nama"`
	NamaMudir     string `json:"nama_mudir"`
	TandaTangan   string `json:"tanda_tangan"` // data URL (base64 PNG) atau kosong
}

// GetMudirTingkatan mengembalikan daftar semua tingkatan beserta nama mudir &
// tanda tangannya (kosong bila belum diisi). Dipakai untuk halaman Settings.
func GetMudirTingkatan(ctx context.Context) ([]MudirTingkatan, error) {
	rows, err := config.DB.Query(ctx,
		`SELECT t.id, t.nama, COALESCE(m.nama_mudir, ''), COALESCE(m.tanda_tangan, '')
		 FROM tingkatan t
		 LEFT JOIN mudir_tingkatan m ON m.tingkatan_id = t.id
		 ORDER BY t.id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []MudirTingkatan
	for rows.Next() {
		var m MudirTingkatan
		if err := rows.Scan(&m.TingkatanID, &m.TingkatanNama, &m.NamaMudir, &m.TandaTangan); err != nil {
			return nil, err
		}
		results = append(results, m)
	}
	return results, nil
}

// UpsertMudirTingkatan menyimpan (insert/update) nama mudir untuk satu tingkatan.
// Tidak menghapus baris agar tanda tangan yang sudah ada tidak ikut hilang saat
// nama dikosongkan; kolom nama boleh kosong.
func UpsertMudirTingkatan(ctx context.Context, tingkatanID int, namaMudir string) error {
	_, err := config.DB.Exec(ctx,
		`INSERT INTO mudir_tingkatan (tingkatan_id, nama_mudir, updated_at)
		 VALUES ($1, $2, CURRENT_TIMESTAMP)
		 ON CONFLICT (tingkatan_id)
		 DO UPDATE SET nama_mudir = EXCLUDED.nama_mudir, updated_at = CURRENT_TIMESTAMP`,
		tingkatanID, strings.TrimSpace(namaMudir))
	return err
}

// UpsertMudirTandaTangan menyimpan/menghapus tanda tangan digital mudir (data URL).
// dataURL kosong → hapus tanda tangan (kolom di-set NULL). Baris dibuat bila belum ada.
func UpsertMudirTandaTangan(ctx context.Context, tingkatanID int, dataURL string) error {
	var ttd interface{}
	if strings.TrimSpace(dataURL) == "" {
		ttd = nil
	} else {
		ttd = dataURL
	}
	_, err := config.DB.Exec(ctx,
		`INSERT INTO mudir_tingkatan (tingkatan_id, nama_mudir, tanda_tangan, updated_at)
		 VALUES ($1, '', $2, CURRENT_TIMESTAMP)
		 ON CONFLICT (tingkatan_id)
		 DO UPDATE SET tanda_tangan = EXCLUDED.tanda_tangan, updated_at = CURRENT_TIMESTAMP`,
		tingkatanID, ttd)
	return err
}

func GetRaportSettings(ctx context.Context) (RaportSettings, error) {
	var s RaportSettings
	err := config.DB.QueryRow(ctx,
		`SELECT id, COALESCE(header_baris_1, ''), COALESCE(header_baris_2, ''), COALESCE(header_baris_3, ''), COALESCE(nama_kepala, ''), COALESCE(nip_kepala, ''), COALESCE(logo_url, '') 
		 FROM rapot_settings 
		 ORDER BY id DESC LIMIT 1`).
		Scan(&s.ID, &s.HeaderBaris1, &s.HeaderBaris2, &s.HeaderBaris3, &s.NamaKepala, &s.NIPKepala, &s.LogoURL)
	return s, err
}

func GetRaportSantri(ctx context.Context, santriID int, semester int, tahunAjaran string) (RaportData, error) {
	var result RaportData

	// 1. Dapatkan Profil Santri.
	//    "No. Stambuk" di raport = nomor POSISI (nomor_stambuk_urut) berupa ANGKA murni.
	//    Bukan kode registrasi manual (stambuk). Bila belum disusun ulang untuk
	//    kelasnya, dibiarkan kosong.
	var nama string
	var stambukUrut *int
	err := config.DB.QueryRow(ctx,
		"SELECT nama, nomor_stambuk_urut FROM santri WHERE id=$1", santriID).
		Scan(&nama, &stambukUrut)
	if err != nil {
		return result, err
	}
	stambukTampil := ""
	var stambukVal string
	_ = config.DB.QueryRow(ctx, "SELECT COALESCE(stambuk, '') FROM santri WHERE id=$1", santriID).Scan(&stambukVal)
	if stambukVal != "" {
		stambukTampil = stambukVal
	} else if stambukUrut != nil && *stambukUrut > 0 {
		stambukTampil = fmt.Sprintf("%d", *stambukUrut)
	}
	result.Santri = map[string]interface{}{"id": santriID, "nama": nama, "stambuk": stambukTampil}

	// 2. Dapatkan Settings Raport
	settings, _ := GetRaportSettings(ctx)
	result.Settings = settings

	// 2b. Dapatkan Bagian/Kelas (الصف = kelas, القسم = bagian) & nama Mudarris (mustahiq).
	var bagianID *int
	var bagianNama, kelasNama, tingkatanNama string
	config.DB.QueryRow(ctx,
		`SELECT s.bagian_id, COALESCE(b.nama_bagian, ''), COALESCE(k.nama, ''), COALESCE(t.nama, '')
		 FROM santri s
		 LEFT JOIN bagian b ON s.bagian_id = b.id
		 LEFT JOIN kelas k ON b.kelas_id = k.id
		 LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		 WHERE s.id = $1`, santriID).Scan(&bagianID, &bagianNama, &kelasNama, &tingkatanNama)
	result.BagianNama = bagianNama
	result.KelasNama = kelasNama
	result.TingkatanNama = tingkatanNama

	if bagianID != nil {
		// Nomor Tamrin = nomor urut absen dalam BAGIAN, diurutkan alfabet nama (A-Z).
		// Bersifat dinamis: otomatis tersusun ulang setiap tahun / saat santri pindah
		// bagian, karena selalu diturunkan dari keanggotaan bagian saat ini.
		var tamrin int
		if err := config.DB.QueryRow(ctx,
			`SELECT urut FROM (
			   SELECT id, ROW_NUMBER() OVER (ORDER BY nama ASC, id ASC) AS urut
			   FROM santri
			   WHERE bagian_id = $1 AND status = 'aktif'
			 ) t WHERE id = $2`, *bagianID, santriID).Scan(&tamrin); err == nil && tamrin > 0 {
			result.Santri["nomor_tamrin"] = tamrin
		}

		var mudarris string
		config.DB.QueryRow(ctx,
			`SELECT COALESCE(NULLIF(p.nama_arab, ''), p.nama)
			 FROM pengajar_bagian pb
			 JOIN pengajar p ON pb.pengajar_id = p.id
			 WHERE pb.bagian_id = $1 AND pb.peran = 'mustahiq'
			 ORDER BY pb.tahun_ajaran DESC
			 LIMIT 1`, *bagianID).Scan(&mudarris)
		result.NamaMudarris = mudarris

		// Nama Mudir (مدير المعهد) berdasarkan tingkatan bagian santri.
		// Dipakai untuk tanda tangan raport semester 2. Kosong bila belum diisi.
		var mudir, ttdMudir string
		config.DB.QueryRow(ctx,
			`SELECT COALESCE(m.nama_mudir, ''), COALESCE(m.tanda_tangan, '')
			 FROM bagian b
			 JOIN mudir_tingkatan m ON m.tingkatan_id = b.tingkatan_id
			 WHERE b.id = $1
			 LIMIT 1`, *bagianID).Scan(&mudir, &ttdMudir)
		result.NamaMudir = mudir
		result.TtdMudir = ttdMudir
	}

	// 3. Dapatkan Daftar Nilai per Mapel: Khos (خاصة) siswi + 'Am (عامة) kelas.
	//    Mapel terikat ke KELAS + TINGKATAN bagian santri (lihat migrasi 011).
	//    nama_mapel = fann, nama_kitab = kitab.
	
	q1, q2 := 1, 2
	if semester == 2 {
		q1, q2 = 3, 4
	}
	
	rows, err := config.DB.Query(ctx,
		`SELECT m.nama_mapel, COALESCE(m.nama_kitab, ''), m.kategori, nk.nilai_akhir, na.nilai_am
		 FROM mata_pelajaran m
		 JOIN santri s ON s.id = $1
		 JOIN bagian b ON s.bagian_id = b.id
		 LEFT JOIN nilai_khos nk ON m.id = nk.mapel_id AND nk.santri_id = $1 AND nk.semester = $2 AND nk.tahun_ajaran = $3
		 LEFT JOIN nilai_am na ON m.id = na.mapel_id AND na.bagian_id = s.bagian_id AND na.semester = $2 AND na.tahun_ajaran = $3
		 WHERE ((m.kelas_id = b.kelas_id AND m.tingkatan_id = b.tingkatan_id)
		        OR EXISTS (SELECT 1 FROM nilai_kuartal nk2
		                   WHERE nk2.mapel_id = m.id AND nk2.santri_id = $1 AND nk2.tahun_ajaran = $3))
		       AND NOT (
		           -- Dedupe: mapel kelas lama disembunyikan jika santri SUDAH punya nilai
		           -- di mapel bernama sama pada kelas SEKARANG (input dobel).
		           NOT (m.kelas_id = b.kelas_id AND m.tingkatan_id = b.tingkatan_id)
		           AND EXISTS (
		               SELECT 1 FROM mata_pelajaran m2
		               JOIN nilai_kuartal nk3 ON nk3.mapel_id = m2.id
		                            AND nk3.santri_id = $1 AND nk3.tahun_ajaran = $3
		               WHERE m2.kelas_id = b.kelas_id AND m2.tingkatan_id = b.tingkatan_id
		                 AND m2.nama_mapel = m.nama_mapel
		           )
		       )
		       AND (m.aktif_kuartal @> to_jsonb($4::int) OR m.aktif_kuartal @> to_jsonb($5::int))
		 ORDER BY m.urutan ASC, m.id ASC`, santriID, semester, tahunAjaran, q1, q2)

	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var mapel, namaKitab, kategori string
			var khos, am *float64
			rows.Scan(&mapel, &namaKitab, &kategori, &khos, &am)
			result.Nilai = append(result.Nilai, map[string]interface{}{
				"mapel":      mapel,
				"nama_kitab": namaKitab,
				"kategori":   kategori,
				"khos":       khos,
				"am":         am,
			})
		}
	}
	// NilaiAm dibiarkan nil di level raport karena 'Am kini per mapel (ada di tiap baris).
	result.NilaiAm = nil

	// 5. Dapatkan Absensi (Sum untuk semester ini)
	// Asumsi semester 1 = kuartal 1, 2. Semester 2 = kuartal 3, 4.
	q1, q2 = 1, 2
	if semester == 2 {
		q1, q2 = 3, 4
	}
	var totalIzin, totalAlpha int
	config.DB.QueryRow(ctx,
		`SELECT COALESCE(SUM(total_izin), 0), COALESCE(SUM(total_alpha), 0)
		 FROM rekap_absensi ra
		 JOIN kalender_kuartal kk ON ra.kuartal_id = kk.id
		 WHERE ra.santri_id = $1 AND kk.kuartal IN ($2, $3) AND kk.tahun_ajaran = $4`, santriID, q1, q2, tahunAjaran).Scan(&totalIzin, &totalAlpha)

	// Gabungkan data dari absensi_manual_bulanan. Difilter per semester: bulan
	// Hijri yang sudah di-mapping (kolom semester) hanya masuk ke raport semester
	// tersebut. Baris tanpa mapping (semester NULL) tidak dihitung di sini —
	// akan terisi otomatis (backfill) saat kalender akademik disimpan.
	var manualIzin, manualAlpha int
	_ = config.DB.QueryRow(ctx,
		`SELECT COALESCE(SUM(total_izin), 0), COALESCE(SUM(total_alpha), 0)
		 FROM absensi_manual_bulanan
		 WHERE santri_id = $1 AND tahun_ajaran = $2 AND semester = $3`, santriID, tahunAjaran, semester).Scan(&manualIzin, &manualAlpha)

	// Satuan tersimpan = PERTEMUAN → tampilkan dalam HARI (ceil ½) per semester + absensi manual.
	// Sakit sengaja tidak dilaporkan di raport (hanya izin & alpha).
	result.Absensi = map[string]interface{}{
		"izin":  PertemuanKeHari(totalIzin) + manualIzin,
		"alpha": PertemuanKeHari(totalAlpha) + manualAlpha,
	}

	// 6. Al-Bayan (البيان) — label tahunan siswi. Hanya relevan untuk semester 2
	//    (laporan akhir tahun), tapi diambil apa adanya bila tersedia. Kosong bila belum di-generate.
	var bayanLabel string
	config.DB.QueryRow(ctx,
		`SELECT COALESCE(nilai_label, '')
		 FROM nilai_bayan
		 WHERE santri_id = $1
		 ORDER BY tahun_ajaran DESC, updated_at DESC
		 LIMIT 1`, santriID).Scan(&bayanLabel)
	result.Bayan = bayanLabel
	result.TahunAjaran = tahunAjaran

	return result, nil
}
