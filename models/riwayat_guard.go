package models

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// Guard riwayat_bagian (insiden 2026-10-07: 4× uji coba naik/turun kelas +
// kalender TA diganti menghasilkan baris kebalik — tanggal_mulai > tanggal_selesai
// — dan baris baru yang tumpang tindih dengan riwayat lama).
//
// Aturan yang dijaga semua jalur penutupan riwayat:
//   - tanggal_selesai sebuah baris TIDAK PERNAH lebih awal dari tanggal_mulainya;
//   - riwayat baru TIDAK PERNAH dibuka sebelum hari tutup efektif riwayat lama.

// tutupRiwayatTerbuka menutup semua riwayat terbuka milik santri pada tanggal
// acuan, memakai GREATEST(acuan, tanggal_mulai) agar baris tidak pernah
// kebalik walau kalender/TA aktif berubah di tengah jalan. Mengembalikan
// tanggal tutup EFEKTIF (max acuan & tanggal_mulai baris terbuka; = acuan
// bila tidak ada baris terbuka) sebagai batas bawah pembukaan riwayat baru.
func tutupRiwayatTerbuka(ctx context.Context, tx pgx.Tx, santriID int, acuan time.Time) (time.Time, error) {
	tgl := acuan.Format("2006-01-02")
	var tutup time.Time
	if err := tx.QueryRow(ctx,
		`SELECT COALESCE(MAX(GREATEST($2::date, tanggal_mulai)), $2::date)
		   FROM riwayat_bagian
		  WHERE santri_id = $1 AND tanggal_selesai IS NULL`,
		santriID, tgl).Scan(&tutup); err != nil {
		return time.Time{}, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE riwayat_bagian
		    SET tanggal_selesai = GREATEST($2::date, tanggal_mulai)
		  WHERE santri_id = $1 AND tanggal_selesai IS NULL`,
		santriID, tgl); err != nil {
		return time.Time{}, err
	}
	if tutup.IsZero() {
		tutup = acuan
	}
	return tutup, nil
}

// tanggalPalingAwal menghitung hari pembukaan riwayat baru yang aman:
// tidak boleh sebelum hari tutup efektif riwayat lama (bila acuan lebih
// awal, digeser ke hari tutup — sama-sama hari ini = serah terima satu hari,
// sama seperti perilaku lama tanpa guard).
func tanggalPalingAwal(acuan time.Time, tutupEfektif time.Time) time.Time {
	if acuan.Before(tutupEfektif) {
		return tutupEfektif
	}
	return acuan
}

// parseTanggalAMAN mem-parse "YYYY-MM-DD"; gagal → hari ini (aman: hari ini
// selalu menghasilkan riwayat yang valid, sama seperti fallback CURRENT_DATE).
func parseTanggalAMAN(s string) time.Time {
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t
	}
	return time.Now()
}
