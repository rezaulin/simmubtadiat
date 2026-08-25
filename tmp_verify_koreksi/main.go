package main

// Verifier: membuktikan koreksi absensi pada Akhlaq (per semester) dan
// Al-Bayan (tahunan) benar-benar berfungsi dengan memanggil fungsi asli.
import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mubtadiaat/app/config"
	"github.com/mubtadiaat/app/models"
)

const ta = "2099/2100" // tahun ajaran sintetis agar tidak menabrak data riil

func must(err error, msg string) {
	if err != nil {
		fmt.Println("GAGAL:", msg, "->", err)
		os.Exit(1)
	}
}

func main() {
	ctx := context.Background()
	dsn := "postgres://" + os.Getenv("DB_USER") + ":" + os.Getenv("DB_PASS") +
		"@" + os.Getenv("DB_HOST") + ":" + os.Getenv("DB_PORT") + "/" + os.Getenv("DB_NAME") + "?sslmode=disable"
	pool, err := pgxpool.New(ctx, dsn)
	must(err, "koneksi DB")
	config.DB = pool
	defer pool.Close()

	var tingkatID, kelasID, bagianID, santriID, mapelAkhlaq, mapelUmum int
	var q1, q2, q3, q4 int

	// --- Setup data sintetis ---
	must(pool.QueryRow(ctx, `INSERT INTO tingkatan (nama, urutan) VALUES ('V-Tingkat', 99) RETURNING id`).Scan(&tingkatID), "insert tingkatan")
	must(pool.QueryRow(ctx, `INSERT INTO kelas (nama, tahun_masuk) VALUES ('V-Kelas', '2099') RETURNING id`).Scan(&kelasID), "insert kelas")
	must(pool.QueryRow(ctx, `INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1,$2,'V-A') RETURNING id`, kelasID, tingkatID).Scan(&bagianID), "insert bagian")
	must(pool.QueryRow(ctx, `INSERT INTO santri (nik, stambuk, nama, bagian_id, status) VALUES ('VNIK','VSTB','V-Santri',$1,'aktif') RETURNING id`, bagianID).Scan(&santriID), "insert santri")
	must(pool.QueryRow(ctx, `INSERT INTO mata_pelajaran (kelas_id, tingkatan_id, nama_mapel, kategori, aktif_kuartal) VALUES ($1,$2,'V-Akhlaq','akhlaq_perilaku','[1,2,3,4]') RETURNING id`, kelasID, tingkatID).Scan(&mapelAkhlaq), "insert mapel akhlaq")
	must(pool.QueryRow(ctx, `INSERT INTO mata_pelajaran (kelas_id, tingkatan_id, nama_mapel, kategori, aktif_kuartal) VALUES ($1,$2,'V-Umum','umum','[1,2,3,4]') RETURNING id`, kelasID, tingkatID).Scan(&mapelUmum), "insert mapel umum")
	for q := 1; q <= 4; q++ {
		var id int
		must(pool.QueryRow(ctx, `INSERT INTO kalender_kuartal (tahun_ajaran, kuartal, tgl_mulai, tgl_selesai) VALUES ($1,$2,NOW(),NOW()) RETURNING id`, ta, q).Scan(&id), "insert kuartal")
		switch q {
		case 1:
			q1 = id
		case 2:
			q2 = id
		case 3:
			q3 = id
		case 4:
			q4 = id
		}
	}

	// Nilai kuartal: akhlaq K1=7.4, K2=7.6 -> avg 7.5 -> bulat 8 (base).
	must(exec(ctx, pool, `INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai, tahun_ajaran) VALUES ($1,$2,1,7.4,$3)`, santriID, mapelAkhlaq, ta), "nilai akhlaq k1")
	must(exec(ctx, pool, `INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai, tahun_ajaran) VALUES ($1,$2,2,7.6,$3)`, santriID, mapelAkhlaq, ta), "nilai akhlaq k2")
	must(exec(ctx, pool, `INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai, tahun_ajaran) VALUES ($1,$2,3,7.4,$3)`, santriID, mapelAkhlaq, ta), "nilai akhlaq k3")
	must(exec(ctx, pool, `INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai, tahun_ajaran) VALUES ($1,$2,4,7.6,$3)`, santriID, mapelAkhlaq, ta), "nilai akhlaq k4")
	// Mapel umum (kontrol, tidak boleh terpengaruh absensi).
	must(exec(ctx, pool, `INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai, tahun_ajaran) VALUES ($1,$2,1,8,$3)`, santriID, mapelUmum, ta), "nilai umum k1")
	must(exec(ctx, pool, `INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai, tahun_ajaran) VALUES ($1,$2,2,8,$3)`, santriID, mapelUmum, ta), "nilai umum k2")
	must(exec(ctx, pool, `INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai, tahun_ajaran) VALUES ($1,$2,3,8,$3)`, santriID, mapelUmum, ta), "nilai umum k3")
	must(exec(ctx, pool, `INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai, tahun_ajaran) VALUES ($1,$2,4,8,$3)`, santriID, mapelUmum, ta), "nilai umum k4")

	// Absensi: izin 40 pertemuan di kuartal 1 => 20 hari (>=20) => Akhlaq Smt1 -1.
	must(exec(ctx, pool, `INSERT INTO rekap_absensi (santri_id, kuartal_id, total_izin, total_alpha) VALUES ($1,$2,40,0)`, santriID, q1), "absensi q1")
	_ = q2
	_ = q3
	_ = q4

	defer cleanup(ctx, pool, santriID, mapelAkhlaq, mapelUmum, bagianID, kelasID, tingkatID, q1, q2, q3, q4)

	// --- TEST 1: Akhlaq Semester 1 kena -1 (izin 20 hari), mapel umum tidak ---
	must(models.GenerateNilaiKhos(ctx, santriID, 1, ta), "GenerateNilaiKhos smt1")
	var akhlaq1, umum1 float64
	must(pool.QueryRow(ctx, `SELECT nilai_akhir FROM nilai_khos WHERE santri_id=$1 AND mapel_id=$2 AND semester=1 AND tahun_ajaran=$3`, santriID, mapelAkhlaq, ta).Scan(&akhlaq1), "baca khos akhlaq smt1")
	must(pool.QueryRow(ctx, `SELECT nilai_akhir FROM nilai_khos WHERE santri_id=$1 AND mapel_id=$2 AND semester=1 AND tahun_ajaran=$3`, santriID, mapelUmum, ta).Scan(&umum1), "baca khos umum smt1")
	fmt.Printf("TEST1 Smt1: Akhlaq=%.0f (harapan 7 = base 8 - 1), Umum=%.0f (harapan 8)\n", akhlaq1, umum1)
	if akhlaq1 == 7 && umum1 == 8 {
		fmt.Println("TEST1 PASS ✓ — koreksi akhlaq per semester berfungsi, mapel umum tak terpengaruh")
	} else {
		fmt.Println("TEST1 FAIL ✗")
	}

	// --- TEST 2: Semester 2 tanpa absensi tambahan -> tidak ada koreksi ---
	must(models.GenerateNilaiKhos(ctx, santriID, 2, ta), "GenerateNilaiKhos smt2")
	var akhlaq2 float64
	must(pool.QueryRow(ctx, `SELECT nilai_akhir FROM nilai_khos WHERE santri_id=$1 AND mapel_id=$2 AND semester=2 AND tahun_ajaran=$3`, santriID, mapelAkhlaq, ta).Scan(&akhlaq2), "baca khos akhlaq smt2")
	fmt.Printf("TEST2 Smt2: Akhlaq=%.0f (harapan 8, karena absensi q1 tak masuk smt2)\n", akhlaq2)
	if akhlaq2 == 8 {
		fmt.Println("TEST2 PASS ✓ — absensi smt1 tidak bocor ke smt2")
	} else {
		fmt.Println("TEST2 FAIL ✗")
	}

	// --- TEST 3: Al-Bayan tahunan. Tambah alpha 10 pertemuan (5 hari) di q4.
	// Izin total = 40 pertemuan (20 hari) >= 15 => -1. Alpha = 10 pertemuan (5 hari) >= 5 => -1.
	must(exec(ctx, pool, `INSERT INTO rekap_absensi (santri_id, kuartal_id, total_izin, total_alpha) VALUES ($1,$2,0,10)`, santriID, q4), "absensi q4")
	must(models.GenerateAlBayan(ctx, santriID, ta), "GenerateAlBayan")
	var bayanAngka int
	var bayanLabel string
	must(pool.QueryRow(ctx, `SELECT nilai_angka, label_arab FROM nilai_bayan WHERE santri_id=$1 AND tahun_ajaran=$2`, santriID, ta).Scan(&bayanAngka, &bayanLabel), "baca bayan")
	// rata2 khos semua mapel: akhlaq smt1=7, smt2=8, umum smt1=8, smt2=8 => avg 7.75 => bulat 8. koreksi -2 => 6.
	fmt.Printf("TEST3 Bayan: angka=%d label=%s (harapan 6 = base 8 - 2)\n", bayanAngka, bayanLabel)
	if bayanAngka == 6 {
		fmt.Println("TEST3 PASS ✓ — koreksi Al-Bayan tahunan berfungsi")
	} else {
		fmt.Println("TEST3 FAIL ✗")
	}
	// --- TEST 4: clamping max Al-Bayan = 9 (tanpa Mumtaz) ---
	// Semua nilai kuartal tinggi -> rata2 ~9 -> bulat 9/10 -> harus clamp ke 9.
	for _, mk := range []struct{ mapel, k int }{{mapelAkhlaq, 1}, {mapelAkhlaq, 2}, {mapelAkhlaq, 3}, {mapelAkhlaq, 4}, {mapelUmum, 1}, {mapelUmum, 2}, {mapelUmum, 3}, {mapelUmum, 4}} {
		pool.Exec(ctx, `UPDATE nilai_kuartal SET nilai = 9.4 WHERE santri_id=$1 AND mapel_id=$2 AND kuartal=$3 AND tahun_ajaran=$4`, santriID, mk.mapel, mk.k, ta)
	}
	pool.Exec(ctx, `DELETE FROM rekap_absensi WHERE santri_id=$1`, santriID) // tanpa absensi
	must(models.GenerateNilaiKhos(ctx, santriID, 1, ta), "khos smt1 test4")
	must(models.GenerateNilaiKhos(ctx, santriID, 2, ta), "khos smt2 test4")
	must(models.GenerateAlBayan(ctx, santriID, ta), "bayan test4")
	var angka4 int
	var label4 string
	must(pool.QueryRow(ctx, `SELECT nilai_angka, label_arab FROM nilai_bayan WHERE santri_id=$1 AND tahun_ajaran=$2`, santriID, ta).Scan(&angka4, &label4), "baca bayan test4")
	fmt.Printf("TEST4 Bayan: angka=%d label=%s (harapan 9 = الجيد الأول, bukan 10)\n", angka4, label4)
	if angka4 == 9 && label4 == "الجيد الأول" {
		fmt.Println("TEST4 PASS ✓ — max 9 Jayyid Awal, tidak ada Mumtaz")
	} else {
		fmt.Println("TEST4 FAIL ✗")
	}

}

func exec(ctx context.Context, pool *pgxpool.Pool, q string, args ...interface{}) error {
	_, err := pool.Exec(ctx, q, args...)
	return err
}

func cleanup(ctx context.Context, pool *pgxpool.Pool, santriID, mapelAkhlaq, mapelUmum, bagianID, kelasID, tingkatID, q1, q2, q3, q4 int) {
	pool.Exec(ctx, `DELETE FROM nilai_bayan WHERE santri_id=$1`, santriID)
	pool.Exec(ctx, `DELETE FROM nilai_khos WHERE santri_id=$1`, santriID)
	pool.Exec(ctx, `DELETE FROM nilai_kuartal WHERE santri_id=$1`, santriID)
	pool.Exec(ctx, `DELETE FROM rekap_absensi WHERE santri_id=$1`, santriID)
	pool.Exec(ctx, `DELETE FROM santri WHERE id=$1`, santriID)
	pool.Exec(ctx, `DELETE FROM mata_pelajaran WHERE id IN ($1,$2)`, mapelAkhlaq, mapelUmum)
	pool.Exec(ctx, `DELETE FROM bagian WHERE id=$1`, bagianID)
	pool.Exec(ctx, `DELETE FROM kelas WHERE id=$1`, kelasID)
	pool.Exec(ctx, `DELETE FROM tingkatan WHERE id=$1`, tingkatID)
	pool.Exec(ctx, `DELETE FROM kalender_kuartal WHERE id IN ($1,$2,$3,$4)`, q1, q2, q3, q4)
	fmt.Println("cleanup selesai")
}
