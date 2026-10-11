package models

// Sentinel error internal — solusi temuan N1 audit 2026-10-11: error pgx
// mentah (FK violation, SQLSTATE, nama tabel/constraint) bocor ke client
// lewat `err.Error()` pada handler (terbukti live di SaveTakziran).
//
// Pola: fungsi model membungkus error DB dengan serverErr() → handler
// mengecek errors.Is(err, models.ErrServer) → balas 500 generik
// (internalError) + log detail di server. Error DOMAIN (validasi input,
// "akses ditolak", dsb) tetap errors.New biasa → tetap tampil apa adanya.

import (
	"errors"
	"fmt"
)

// ErrServer menandai error INTERNAL (database/pgx) yang TIDAK boleh
// ditampilkan ke client.
var ErrServer = errors.New("kesalahan server")

// serverErr membungkus error DB mentah: teks error tetap memuat detail
// asli (untuk log), tapi errors.Is(err, ErrServer) bernilai true.
func serverErr(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%w: %v", ErrServer, err)
}
