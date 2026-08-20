package models

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/mubtadiaat/app/config"
)

// PerizinanInput adalah status NON-hadir seorang santri pada satu sesi/pertemuan.
// Status: "izin" (bi idzni), "sakit", atau "alpha" (bi ghoiri idzni). Santri hadir
// TIDAK dikirim (hadir diturunkan dari jumlah sesi − non-hadir).
type PerizinanInput struct {
	SantriID   int    `json:"santri_id"`
	Status     string `json:"status"`
	Keterangan string `json:"keterangan"`
}

// SesiAbsensiInput adalah payload pengisian absensi untuk satu slot/pertemuan.
type SesiAbsensiInput struct {
	TahunAjaran string           `json:"tahun_ajaran"`
	BagianID    int              `json:"bagian_id"`
	JadwalID    *int             `json:"jadwal_id"`
	MapelID     *int             `json:"mapel_id"`
	Pertemuan   int              `json:"pertemuan"` // 1 atau 2
	Tanggal     string           `json:"tanggal"`   // YYYY-MM-DD
	Data        []PerizinanInput `json:"data"`
}

// PertemuanKeHari mengonversi jumlah pertemuan menjadi hari. Tiap pertemuan = ½ hari,
// diakumulasikan lalu dibulatkan KE ATAS (ceil) bila ada sisa setengah:
//
//	hari = ceil(pertemuan / 2) = (pertemuan + 1) / 2   (untuk pertemuan >= 0)
//
// Contoh: 41 → 21, 19 → 10, 0 → 0. Nilai negatif diperlakukan sebagai 0.
func PertemuanKeHari(pertemuan int) int {
	if pertemuan <= 0 {
		return 0
	}
	return (pertemuan + 1) / 2
}

// validStatus memvalidasi nilai status non-hadir.
func validStatus(s string) bool {
	return s == "izin" || s == "sakit" || s == "alpha"
}

// CheckMuroqibScope verifies if a Muroqib is assigned to the santri's bagian.
func CheckMuroqibScope(ctx context.Context, pengajarID int, santriID int, tahunAjaran string) (bool, error) {
	var count int
	err := config.DB.QueryRow(ctx,
		`SELECT COUNT(pb.id) 
		 FROM pengajar_bagian pb
		 JOIN santri s ON s.bagian_id = pb.bagian_id
		 WHERE pb.pengajar_id = $1 AND s.id = $2 AND pb.tahun_ajaran = $3 AND pb.peran = 'muroqib'`,
		pengajarID, santriID, tahunAjaran).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// CheckMuroqibBagian verifies a Muroqib is assigned to a bagian for the year.
func CheckMuroqibBagian(ctx context.Context, pengajarID int, bagianID int, tahunAjaran string) (bool, error) {
	var count int
	err := config.DB.QueryRow(ctx,
		`SELECT COUNT(id) FROM pengajar_bagian
		 WHERE pengajar_id = $1 AND bagian_id = $2 AND tahun_ajaran = $3 AND peran = 'muroqib'`,
		pengajarID, bagianID, tahunAjaran).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// InputAbsensiSesi menyimpan absensi satu sesi/pertemuan:
//   - upsert 1 baris absensi_sesi (bukti "ustadz masuk" slot ini), lalu
//   - ganti seluruh baris NON-hadir (izin/sakit/alpha) santri yang tertaut ke sesi,
//   - hitung ulang rekap_absensi (pertemuan) untuk seluruh santri pada bagian.
//
// Submit SELALU mencatat sesi walau seluruh santri hadir (Data kosong).
func InputAbsensiSesi(ctx context.Context, in SesiAbsensiInput, pengajarID *int, roles []string) error {
	if in.Pertemuan != 1 && in.Pertemuan != 2 {
		return errors.New("pertemuan harus 1 atau 2")
	}
	if in.BagianID <= 0 {
		return errors.New("bagian_id wajib")
	}
	if in.Tanggal == "" {
		return errors.New("tanggal wajib")
	}
	tahunAjaran := in.TahunAjaran
	if tahunAjaran == "" {
		tahunAjaran = GetTahunAjaranAktif(ctx)
	}

	// Enforcement kunci: absensi ikut terkunci bersama semesternya. Turunkan
	// semester dari kuartal yang menaungi tanggal ini; bila TERKUNCI, tolak.
	var kuartalTgl int
	if err := config.DB.QueryRow(ctx,
		`SELECT kuartal FROM kalender_kuartal
		 WHERE tahun_ajaran = $1 AND $2 >= tgl_mulai AND $2 <= tgl_selesai
		 LIMIT 1`, tahunAjaran, in.Tanggal).Scan(&kuartalTgl); err == nil && kuartalTgl > 0 {
		locked, err := IsSemesterLocked(ctx, tahunAjaran, SemesterDariKuartal(kuartalTgl))
		if err != nil {
			return err
		}
		if locked {
			return errors.New("absensi semester ini sudah terkunci")
		}
	}

	isGlobal := false
	for _, r := range roles {
		if r == "pimpinan" || r == "admin" || r == "muroqib" {
			isGlobal = true
			break
		}
	}

	if !isGlobal {
		hasAccess := false
		for _, r := range roles {
			if r == "mustahiq" {
				hasAccess = true // mustahiq relies on GetSantriByBagian restriction
				break
			} else if r == "muroqib" {
				if pengajarID != nil {
					ok, _ := CheckMuroqibBagian(ctx, *pengajarID, in.BagianID, tahunAjaran)
					if ok {
						hasAccess = true
						break
					}
				}
			} else if r == "mufatish" {
				if pengajarID != nil {
					var isSubordinate int
					err := config.DB.QueryRow(ctx,
						`SELECT COUNT(1) FROM mufatish_kelas mk
						 JOIN bagian b ON b.kelas_id = mk.kelas_id AND b.tingkatan_id = mk.tingkatan_id
						 WHERE mk.pengajar_id = $1 AND b.id = $2`, *pengajarID, in.BagianID).Scan(&isSubordinate)
					if err == nil && isSubordinate > 0 {
						hasAccess = true
						break
					}
				}
			}
		}
		if !hasAccess {
			return errors.New("akses ditolak: bukan bagian yang diampu")
		}
	}

	// Validasi status sebelum menulis.
	for _, d := range in.Data {
		if !validStatus(d.Status) {
			return errors.New("status tidak valid: harus izin/sakit/alpha")
		}
	}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Upsert sesi → dapatkan sesi_id (bukti ustadz masuk slot ini).
	var sesiID int
	err = tx.QueryRow(ctx,
		`INSERT INTO absensi_sesi (bagian_id, jadwal_id, mapel_id, pengajar_id, tanggal, pertemuan)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (bagian_id, tanggal, pertemuan)
		 DO UPDATE SET jadwal_id = EXCLUDED.jadwal_id, mapel_id = EXCLUDED.mapel_id,
		               pengajar_id = EXCLUDED.pengajar_id, updated_at = now()
		 RETURNING id`,
		in.BagianID, in.JadwalID, in.MapelID, pengajarID, in.Tanggal, in.Pertemuan).Scan(&sesiID)
	if err != nil {
		return err
	}

	// Ganti seluruh baris non-hadir sesi ini (mendukung koreksi/isi ulang).
	if _, err = tx.Exec(ctx, `DELETE FROM absensi_perizinan WHERE sesi_id = $1`, sesiID); err != nil {
		return err
	}
	for _, d := range in.Data {
		if _, err = tx.Exec(ctx,
			`INSERT INTO absensi_perizinan (santri_id, tanggal, status, keterangan, pengajar_id, sesi_id)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			d.SantriID, in.Tanggal, d.Status, d.Keterangan, pengajarID, sesiID); err != nil {
			return err
		}
	}

	// Kuartal untuk tanggal ini (jika ada) → recalc rekap seluruh santri bagian.
	var kuartalID int
	err = tx.QueryRow(ctx,
		`SELECT id FROM kalender_kuartal
		 WHERE tahun_ajaran = $1 AND $2 >= tgl_mulai AND $2 <= tgl_selesai
		 LIMIT 1`,
		tahunAjaran, in.Tanggal).Scan(&kuartalID)
	if err == nil && kuartalID > 0 {
		rows, err := tx.Query(ctx, `SELECT id FROM santri WHERE bagian_id = $1`, in.BagianID)
		if err != nil {
			return err
		}
		var santriIDs []int
		for rows.Next() {
			var sid int
			if err := rows.Scan(&sid); err != nil {
				rows.Close()
				return err
			}
			santriIDs = append(santriIDs, sid)
		}
		rows.Close()
		for _, sid := range santriIDs {
			if err := RecalculateRekapAbsensiTx(ctx, tx, kuartalID, sid); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

// recalcRekapQuery menghitung jumlah PERTEMUAN per status untuk satu santri pada
// rentang [tglMulai, tglSelesai] dan mengembalikan (izin, sakit, alpha).
const recalcRekapQuery = `
	SELECT
		COALESCE(SUM(CASE WHEN status = 'izin'  THEN 1 ELSE 0 END), 0),
		COALESCE(SUM(CASE WHEN status = 'sakit' THEN 1 ELSE 0 END), 0),
		COALESCE(SUM(CASE WHEN status = 'alpha' THEN 1 ELSE 0 END), 0)
	FROM absensi_perizinan
	WHERE santri_id = $1 AND tanggal >= $2 AND tanggal <= $3`

const upsertRekapQuery = `
	INSERT INTO rekap_absensi (santri_id, kuartal_id, total_izin, total_sakit, total_alpha)
	VALUES ($1, $2, $3, $4, $5)
	ON CONFLICT (santri_id, kuartal_id)
	DO UPDATE SET total_izin = EXCLUDED.total_izin, total_sakit = EXCLUDED.total_sakit,
	              total_alpha = EXCLUDED.total_alpha, updated_at = CURRENT_TIMESTAMP`

// RecalculateRekapAbsensi menghitung ulang rekap_absensi (satuan PERTEMUAN) dari
// absensi_perizinan untuk satu santri pada satu kuartal.
func RecalculateRekapAbsensi(ctx context.Context, kuartalID int, santriID int) error {
	var tglMulai, tglSelesai time.Time
	if err := config.DB.QueryRow(ctx,
		"SELECT tgl_mulai, tgl_selesai FROM kalender_kuartal WHERE id=$1", kuartalID).Scan(&tglMulai, &tglSelesai); err != nil {
		return err
	}
	var izin, sakit, alpha int
	if err := config.DB.QueryRow(ctx, recalcRekapQuery, santriID, tglMulai, tglSelesai).Scan(&izin, &sakit, &alpha); err != nil {
		return err
	}
	_, err := config.DB.Exec(ctx, upsertRekapQuery, santriID, kuartalID, izin, sakit, alpha)
	return err
}

// RecalculateRekapAbsensiTx adalah versi transaksional.
func RecalculateRekapAbsensiTx(ctx context.Context, tx pgx.Tx, kuartalID int, santriID int) error {
	var tglMulai, tglSelesai time.Time
	if err := tx.QueryRow(ctx,
		"SELECT tgl_mulai, tgl_selesai FROM kalender_kuartal WHERE id=$1", kuartalID).Scan(&tglMulai, &tglSelesai); err != nil {
		return err
	}
	var izin, sakit, alpha int
	if err := tx.QueryRow(ctx, recalcRekapQuery, santriID, tglMulai, tglSelesai).Scan(&izin, &sakit, &alpha); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, upsertRekapQuery, santriID, kuartalID, izin, sakit, alpha)
	return err
}
