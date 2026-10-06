package models

import (
	"context"
	"errors"
	"time"

	"github.com/mubtadiaat/app/config"
)

// batasTanggalNaikKelas menghitung tanggal tutup riwayat lama & buka riwayat
// baru untuk proses naik kelas, berdasarkan TAHUN AJARAN AKTIF (Pengaturan)
// dan POSISINYA terhadap hari ini.
//
// Dua alur yang didukung (owner 2026-10-06):
//
//  A. TA aktif = tahun berjalan (atau mundur) → naik kelas menyeberangi
//     AKHIR TA aktif (mis. masih 2026/2027, siapkan kelas tahun depan):
//       tutup = hari TERAKHIR TA aktif   (mis. 2027-03-24)
//       buka  = hari PERTAMA TA berikutnya (mis. 2027-03-25)
//
//  B. TA aktif sudah MAJU ke depan (owner ganti TA ke depan dulu, lalu naik
//     kelas — alur uji coba yang disarankan) → naik kelas menyeberangi batas
//     MASUK TA aktif:
//       tutup = hari TERAKHIR TA sebelum aktif (mis. 2027-03-24)
//       buka  = hari PERTAMA TA aktif          (mis. 2027-03-25)
//
// Tanpa cabang B, alur uji menghasilkan tutup = akhir TA depan (2028-01-01)
// dan buka = CURRENT_DATE karena "TA berikutnya" belum punya kalender —
// riwayat lama & baru jadi tumpang tindih dan kelas baru bocor ke tahun lama.
//
// Bila TA aktif tak punya kalender sama sekali, kembalikan ("","") agar
// pemanggil memakai CURRENT_DATE seperti perilaku lama.
func batasTanggalNaikKelas(ctx context.Context) (tutup, buka string) {
	ta := GetTahunAjaranAktif(ctx)
	if ta == "" {
		return "", ""
	}
	// CATATAN PENTING: kolomnya bertipe DATE. pgx mengirimnya sebagai date biner
	// (OID 1082) dan GAGAL di-scan ke *string ("cannot scan date in binary format
	// into *string"). Harus lewat time.Time dulu. Ini pernah bikin fitur ini
	// seolah tidak jalan padahal logikanya benar.
	var akhir time.Time
	if err := config.DB.QueryRow(ctx,
		`SELECT MAX(tgl_selesai) FROM kalender_kuartal WHERE tahun_ajaran = $1`,
		ta).Scan(&akhir); err != nil || akhir.IsZero() {
		return "", ""
	}
	tutup = akhir.Format("2006-01-02")

	// TA yang memuat hari ini ("" = hari di luar semua kalender).
	var hariIni time.Time
	var taHariIni string
	if err := config.DB.QueryRow(ctx, `SELECT CURRENT_DATE`).Scan(&hariIni); err == nil {
		_ = config.DB.QueryRow(ctx,
			`SELECT tahun_ajaran FROM kalender_kuartal
			  WHERE tgl_mulai <= $1 AND tgl_selesai >= $1
			  ORDER BY tgl_mulai LIMIT 1`, hariIni).Scan(&taHariIni)
	}

	// Cabang B: TA aktif di depan tahun berjalan → seberangi batas TA aktif.
	// Format "YYYY/YYYY" urut lexikografis = urut kronologis, jadi ">" aman.
	if taHariIni != "" && ta > taHariIni {
		var akhirSebelumnya time.Time
		if err := config.DB.QueryRow(ctx,
			`SELECT MAX(tgl_selesai) FROM kalender_kuartal WHERE tahun_ajaran < $1`,
			ta).Scan(&akhirSebelumnya); err != nil || akhirSebelumnya.IsZero() {
			return "", ""
		}
		tutup = akhirSebelumnya.Format("2006-01-02")
		// Hari setelah akhir TA sebelumnya = hari pertama TA aktif (kalender
		// berurutan); tetap benar walau kalender TA aktif belum diisi.
		buka = akhirSebelumnya.AddDate(0, 0, 1).Format("2006-01-02")
		return tutup, buka
	}

	// Cabang A: awal TA berikutnya = hari pertama kalender setelah TA aktif.
	var awalNext time.Time
	if err := config.DB.QueryRow(ctx,
		`SELECT MIN(tgl_mulai) FROM kalender_kuartal WHERE tgl_mulai > $1`,
		akhir).Scan(&awalNext); err != nil || awalNext.IsZero() {
		// Kalender TA berikutnya belum ada → pakai hari setelah akhir TA aktif.
		// JANGAN jatuh ke CURRENT_DATE: tanggal campur (tutup kalender, buka
		// hari server) membuat riwayat tumpang tindih.
		return tutup, akhir.AddDate(0, 0, 1).Format("2006-01-02")
	}
	return tutup, awalNext.Format("2006-01-02")
}

// PindahBagian memindahkan santri (satu atau banyak) ke bagian baru dengan menutup riwayat lama.
// Digunakan untuk naik kelas (batch) maupun mutasi (individu).
//
// Tanggal riwayat TIDAK memakai CURRENT_DATE, melainkan batas TAHUN AJARAN
// AKTIF (Pengaturan > Tahun Ajaran, opsi "sumber TA = TA aktif"):
//   - riwayat lama ditutup pada HARI TERAKHIR TA aktif
//   - riwayat baru dibuka pada HARI PERTAMA TA berikutnya
// Dengan begitu naik kelas yang dilakukan kapan pun tetap tercatat di tahun
// ajaran yang benar, tanpa perlu menggeser jam server. Bila kalender TA tidak
// lengkap, jatuh kembali ke CURRENT_DATE (perilaku lama) supaya tidak gagal.
func PindahBagian(ctx context.Context, bagianAsalID int, santriIDs []int, bagianBaruID int, pindahMustahiq bool, roles []string, userID int) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Batas tanggal untuk riwayat: hari terakhir TA aktif & hari pertama TA
	// berikutnya. Kosong = kalender belum lengkap → pakai CURRENT_DATE.
	tglTutup, tglBuka := batasTanggalNaikKelas(ctx)

	// Cek otorisasi mustahiq
	isGlobal := false
	isMustahiq := false
	for _, r := range roles {
		if r == "pimpinan" || r == "admin" {
			isGlobal = true
		}
		if r == "mustahiq" {
			isMustahiq = true
		}
	}

	if isMustahiq && !isGlobal && bagianAsalID > 0 {
		var count int
		err := tx.QueryRow(ctx, `
			SELECT COUNT(1) 
			FROM bagian b_asal
			WHERE b_asal.id = $1 AND EXISTS (
				SELECT 1 FROM bagian b_mus
				JOIN mustahiq_bagian mb ON mb.bagian_id = b_mus.id
				WHERE (mb.user_id = $2 OR mb.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $2)) AND b_mus.tingkatan_id = b_asal.tingkatan_id AND b_mus.kelas_id = b_asal.kelas_id
			)`, bagianAsalID, userID).Scan(&count)
		if err != nil || count == 0 {
			return errors.New("mustahiq tidak berhak memindahkan santri dari bagian ini")
		}
	}

	for _, sID := range santriIDs {
		// 1. Update riwayat_bagian lama yang belum selesai
		if tglTutup != "" {
			_, err := tx.Exec(ctx,
				`UPDATE riwayat_bagian
				 SET tanggal_selesai = $2::date
				 WHERE santri_id = $1 AND tanggal_selesai IS NULL`, sID, tglTutup)
			if err != nil {
				return err
			}
		} else {
			_, err := tx.Exec(ctx,
				`UPDATE riwayat_bagian 
				 SET tanggal_selesai = CURRENT_DATE 
				 WHERE santri_id = $1 AND tanggal_selesai IS NULL`, sID)
			if err != nil {
				return err
			}
		}

		// 2. Buat riwayat_bagian baru (mulai = hari pertama TA berikutnya)
		if tglBuka != "" {
			_, err = tx.Exec(ctx,
				`INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai) 
				 VALUES ($1, $2, $3::date)`, sID, bagianBaruID, tglBuka)
		} else {
			_, err = tx.Exec(ctx,
				`INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai) 
				 VALUES ($1, $2, CURRENT_DATE)`, sID, bagianBaruID)
		}
		if err != nil {
			return err
		}

		// 3. Update master data santri
		_, err = tx.Exec(ctx,
			`UPDATE santri 
			 SET bagian_id = $1, status = 'aktif' 
			 WHERE id = $2`, bagianBaruID, sID)
		if err != nil {
			return err
		}
	}

	if pindahMustahiq && bagianAsalID != 0 {
		_, err := tx.Exec(ctx,
			`UPDATE pengajar_bagian
			 SET bagian_id = $1
			 WHERE bagian_id = $2 AND peran = 'mustahiq'`, bagianBaruID, bagianAsalID)
		if err != nil {
			return err
		}
	}

	// 4. Cek apakah pindah ANTAR TINGKATAN (sebelum commit)
	var tingkatanAsalID int
	if bagianAsalID > 0 {
		_ = tx.QueryRow(ctx, `SELECT tingkatan_id FROM bagian WHERE id = $1`, bagianAsalID).Scan(&tingkatanAsalID)
	}

	var tingkatanID, kelasID int
	err = tx.QueryRow(ctx, `SELECT tingkatan_id, kelas_id FROM bagian WHERE id = $1`, bagianBaruID).Scan(&tingkatanID, &kelasID)
	if err == nil && tingkatanID > 0 && kelasID > 0 {
		if tingkatanAsalID != tingkatanID {
			// Matikan fitur nis auto: jangan override NIS ketika pindah tingkatan
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// 5. Eksekusi Post-Commit (Susun ulang urut stambuk)
	if tingkatanID > 0 && kelasID > 0 {
		// Susun ulang nomor stambuk urut (urutan kelas, bukan NIS).
		_, _ = SusunUlangStambuk(ctx, tingkatanID, kelasID)
	}

	return nil
}

// UbahStatusStatusSantri mengubah status santri (cuti, dll)
// Jika status bukan 'aktif', riwayat kelas berjalan akan ditutup.
func UbahStatusStatusSantri(ctx context.Context, santriID int, status string, tanggalStatus string, alasan string, roles []string, userID int) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Cek otorisasi mustahiq
	isGlobal := false
	isMustahiq := false
	for _, r := range roles {
		if r == "pimpinan" || r == "admin" {
			isGlobal = true
		}
		if r == "mustahiq" {
			isMustahiq = true
		}
	}

	if isMustahiq && !isGlobal {
		var count int
		err := tx.QueryRow(ctx, `
			SELECT COUNT(1) 
			FROM santri s 
			JOIN bagian b_santri ON s.bagian_id = b_santri.id
			WHERE s.id = $1 AND EXISTS (
				SELECT 1 FROM bagian b_mus
				JOIN mustahiq_bagian mb ON mb.bagian_id = b_mus.id
				WHERE (mb.user_id = $2 OR mb.pengajar_id = (SELECT pengajar_id FROM users WHERE id = $2)) AND b_mus.tingkatan_id = b_santri.tingkatan_id AND b_mus.kelas_id = b_santri.kelas_id
			)
		`, santriID, userID).Scan(&count)
		if err != nil || count == 0 {
			return errors.New("mustahiq tidak berhak mengubah status santri ini")
		}
	}

	// Jika tanggal_status string kosong, set nil (untuk jaga-jaga kalau aktif kembali)
	var tanggal interface{}
	var ta string
	if tanggalStatus == "" {
		tanggal = nil
	} else {
		tanggal = tanggalStatus
		_ = tx.QueryRow(ctx, "SELECT tahun_ajaran FROM kalender_kuartal WHERE $1::DATE BETWEEN tgl_mulai AND tgl_selesai LIMIT 1", tanggalStatus).Scan(&ta)
		if ta == "" {
			_ = tx.QueryRow(ctx, "SELECT tahun_ajaran FROM kalender_kuartal ORDER BY tgl_selesai DESC LIMIT 1").Scan(&ta)
		}
	}

	_, err = tx.Exec(ctx, "UPDATE santri SET status = $1, tanggal_status = $2, alasan = $5, last_tahun_ajaran = COALESCE(NULLIF($4, ''), last_tahun_ajaran) WHERE id = $3", status, tanggal, santriID, ta, alasan)
	if err != nil {
		return err
	}

	if status != "aktif" {
		_, err = tx.Exec(ctx,
			`UPDATE riwayat_bagian 
			 SET tanggal_selesai = CURRENT_DATE 
			 WHERE santri_id = $1 AND tanggal_selesai IS NULL`, santriID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
