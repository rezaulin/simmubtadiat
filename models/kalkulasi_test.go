package models

import (
	"context"
	"math"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/mubtadiaat/app/config"
)

// setupTestDB initializes DB connection for testing
func setupTestDB() *pgxpool.Pool {
	_ = godotenv.Load("../.env")
	// For testing, connect directly to localhost
	dsn := "postgres://postgres:postgres@localhost:5432/mubtadiaat_test?sslmode=disable"
	// Fallback to dev if test db URL not provided
	if os.Getenv("TEST_DB_URL") != "" {
		dsn = os.Getenv("TEST_DB_URL")
	} else if os.Getenv("DB_NAME") != "" {
		// Use standard connection but ideally we want a separate test DB
		dbHost := os.Getenv("DB_HOST")
		if dbHost == "" {
			dbHost = "localhost"
		}
		dbPort := os.Getenv("DB_PORT")
		if dbPort == "" {
			dbPort = "5432"
		}
		dbUser := os.Getenv("DB_USER")
		dbPass := os.Getenv("DB_PASS")
		dbName := os.Getenv("DB_NAME")
		dsn = "postgres://" + dbUser + ":" + dbPass + "@" + dbHost + ":" + dbPort + "/" + dbName + "?sslmode=disable"
	}

	configPool, _ := pgxpool.ParseConfig(dsn)
	pool, err := pgxpool.NewWithConfig(context.Background(), configPool)
	if err != nil {
		panic(err)
	}
	config.DB = pool
	return pool
}

// TestNilaiKhos memverifikasi rumus (K1+K2)/2, pembulatan, dan koreksi
// akhlaq-perilaku (Bi Idzni >= 20/semester -> -1).
func TestNilaiKhos(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	var tingkatanID, kelasID, bagianID, santriID, mapelID, kuartal1ID, kuartal2ID int

	err := db.QueryRow(ctx, `INSERT INTO tingkatan (nama, urutan) VALUES ('Test Tingkatan Khos', 1) RETURNING id`).Scan(&tingkatanID)
	if err != nil {
		t.Fatalf("insert tingkatan: %v", err)
	}
	err = db.QueryRow(ctx, `INSERT INTO kelas (nama, tahun_masuk) VALUES ('Test Kelas Khos', '2023') RETURNING id`).Scan(&kelasID)
	if err != nil {
		t.Fatalf("insert kelas: %v", err)
	}
	err = db.QueryRow(ctx, `INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1, $2, 'A1') RETURNING id`, kelasID, tingkatanID).Scan(&bagianID)
	if err != nil {
		t.Fatalf("insert bagian: %v", err)
	}
	err = db.QueryRow(ctx, `INSERT INTO santri (nik, stambuk, nama, bagian_id, status) VALUES ('123', 'STB123', 'Test Santri', $1, 'aktif') RETURNING id`, bagianID).Scan(&santriID)
	if err != nil {
		t.Fatalf("insert santri: %v", err)
	}
	// Kategori 'akhlaq_perilaku' => baris الأخلاق yang bisa diturunkan oleh absensi.
	err = db.QueryRow(ctx, `INSERT INTO mata_pelajaran (kelas_id, tingkatan_id, nama_mapel, kategori) VALUES ($1, $2, 'Akhlaq Perilaku', 'akhlaq_perilaku') RETURNING id`, kelasID, tingkatanID).Scan(&mapelID)
	if err != nil {
		t.Fatalf("insert mapel: %v", err)
	}

	err = db.QueryRow(ctx, `INSERT INTO kalender_kuartal (tahun_ajaran, kuartal, tgl_mulai, tgl_selesai) VALUES ('2023/2024', 1, $1, $2) RETURNING id`, time.Now(), time.Now()).Scan(&kuartal1ID)
	if err != nil {
		t.Fatalf("insert kuartal1: %v", err)
	}
	err = db.QueryRow(ctx, `INSERT INTO kalender_kuartal (tahun_ajaran, kuartal, tgl_mulai, tgl_selesai) VALUES ('2023/2024', 2, $1, $2) RETURNING id`, time.Now(), time.Now()).Scan(&kuartal2ID)
	if err != nil {
		t.Fatalf("insert kuartal2: %v", err)
	}

	// K1 = 6.4, K2 = 6.6 => avg 6.5 => round 7. Izin 40 pertemuan = 20 hari (ceil ½)
	// => memenuhi ambang ≥20 hari => koreksi -1 => 6.
	db.Exec(ctx, `INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai) VALUES ($1, $2, 1, 6.4)`, santriID, mapelID)
	db.Exec(ctx, `INSERT INTO nilai_kuartal (santri_id, mapel_id, kuartal, nilai) VALUES ($1, $2, 2, 6.6)`, santriID, mapelID)
	db.Exec(ctx, `INSERT INTO rekap_absensi (santri_id, kuartal_id, total_izin, total_alpha) VALUES ($1, $2, 40, 0)`, santriID, kuartal1ID)

	defer func() {
		db.Exec(ctx, `DELETE FROM santri WHERE id = $1`, santriID)
		db.Exec(ctx, `DELETE FROM mata_pelajaran WHERE id = $1`, mapelID)
		db.Exec(ctx, `DELETE FROM bagian WHERE id = $1`, bagianID)
		db.Exec(ctx, `DELETE FROM kelas WHERE id = $1`, kelasID)
		db.Exec(ctx, `DELETE FROM tingkatan WHERE id = $1`, tingkatanID)
		db.Exec(ctx, `DELETE FROM kalender_kuartal WHERE id IN ($1, $2)`, kuartal1ID, kuartal2ID)
	}()

	if err := GenerateNilaiKhos(ctx, santriID, 1, "2023/2024"); err != nil {
		t.Fatalf("Failed to GenerateNilaiKhos: %v", err)
	}

	var nilaiKhos float64
	err = db.QueryRow(ctx, `SELECT nilai_akhir FROM nilai_khos WHERE santri_id = $1 AND mapel_id = $2 AND semester = 1`, santriID, mapelID).Scan(&nilaiKhos)
	if err != nil {
		t.Fatalf("Failed to fetch nilai khos: %v", err)
	}

	if nilaiKhos != 6.0 {
		t.Errorf("Expected Nilai Khos to be 6.0, got %v", nilaiKhos)
	}
}

// TestNilaiAm memverifikasi Nilai 'Am sebagai RATA-RATA KELAS per mapel.
func TestNilaiAm(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	var tingkatanID, kelasID, bagianID, mapelID int
	if err := db.QueryRow(ctx, `INSERT INTO tingkatan (nama, urutan) VALUES ('Test Tingkatan Am', 1) RETURNING id`).Scan(&tingkatanID); err != nil {
		t.Fatalf("Tingkatan: %v", err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO kelas (nama, tahun_masuk) VALUES ('Test Kelas Am', '2023') RETURNING id`).Scan(&kelasID); err != nil {
		t.Fatalf("Kelas: %v", err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1, $2, 'T_A') RETURNING id`, kelasID, tingkatanID).Scan(&bagianID); err != nil {
		t.Fatalf("Bagian: %v", err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO mata_pelajaran (kelas_id, tingkatan_id, nama_mapel, kategori) VALUES ($1, $2, 'M1', 'umum') RETURNING id`, kelasID, tingkatanID).Scan(&mapelID); err != nil {
		t.Fatalf("Mapel: %v", err)
	}

	// Tiga siswi dengan Khos untuk mapel M1: 8, 9, 7 => rata-rata kelas = 8.0
	var s1, s2, s3 int
	db.QueryRow(ctx, `INSERT INTO santri (nik, stambuk, nama, bagian_id, status) VALUES ('AM1', 'AM1', 'S1', $1, 'aktif') RETURNING id`, bagianID).Scan(&s1)
	db.QueryRow(ctx, `INSERT INTO santri (nik, stambuk, nama, bagian_id, status) VALUES ('AM2', 'AM2', 'S2', $1, 'aktif') RETURNING id`, bagianID).Scan(&s2)
	db.QueryRow(ctx, `INSERT INTO santri (nik, stambuk, nama, bagian_id, status) VALUES ('AM3', 'AM3', 'S3', $1, 'aktif') RETURNING id`, bagianID).Scan(&s3)

	db.Exec(ctx, `INSERT INTO nilai_khos (santri_id, mapel_id, semester, nilai_akhir) VALUES ($1, $2, 1, 8.0)`, s1, mapelID)
	db.Exec(ctx, `INSERT INTO nilai_khos (santri_id, mapel_id, semester, nilai_akhir) VALUES ($1, $2, 1, 9.0)`, s2, mapelID)
	db.Exec(ctx, `INSERT INTO nilai_khos (santri_id, mapel_id, semester, nilai_akhir) VALUES ($1, $2, 1, 7.0)`, s3, mapelID)

	defer func() {
		db.Exec(ctx, `DELETE FROM nilai_am WHERE bagian_id = $1`, bagianID)
		db.Exec(ctx, `DELETE FROM nilai_khos WHERE mapel_id = $1`, mapelID)
		db.Exec(ctx, `DELETE FROM santri WHERE id IN ($1, $2, $3)`, s1, s2, s3)
		db.Exec(ctx, `DELETE FROM mata_pelajaran WHERE id = $1`, mapelID)
		db.Exec(ctx, `DELETE FROM bagian WHERE id = $1`, bagianID)
		db.Exec(ctx, `DELETE FROM kelas WHERE id = $1`, kelasID)
		db.Exec(ctx, `DELETE FROM tingkatan WHERE id = $1`, tingkatanID)
	}()

	if err := GenerateNilaiAm(ctx, bagianID, 1, "2023/2024"); err != nil {
		t.Fatalf("Failed GenerateNilaiAm: %v", err)
	}

	var nilaiAm float64
	db.QueryRow(ctx, `SELECT nilai_am FROM nilai_am WHERE bagian_id = $1 AND mapel_id = $2 AND semester = 1`, bagianID, mapelID).Scan(&nilaiAm)
	if math.Abs(nilaiAm-8.0) > 0.01 {
		t.Errorf("Expected Nilai Am (rata-rata kelas) to be 8.0, got %v", nilaiAm)
	}
}

// TestAlBayan memverifikasi Al-Bayan dari rata-rata Khos 2 semester,
// koreksi absensi independen, dan label yang benar.
func TestAlBayan(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	var tingkatanID, kelasID, bagianID, santriID, mapelID, kuartalID int
	if err := db.QueryRow(ctx, `INSERT INTO tingkatan (nama, urutan) VALUES ('Test Tingkatan Bayan', 1) RETURNING id`).Scan(&tingkatanID); err != nil {
		t.Fatalf("Tingkatan: %v", err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO kelas (nama, tahun_masuk) VALUES ('Test Kelas Bayan', '2023') RETURNING id`).Scan(&kelasID); err != nil {
		t.Fatalf("Kelas: %v", err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1, $2, 'TB_A') RETURNING id`, kelasID, tingkatanID).Scan(&bagianID); err != nil {
		t.Fatalf("Bagian: %v", err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO santri (nik, stambuk, nama, bagian_id, status) VALUES ('BAY_123', 'BAY_123', 'Test Bayan', $1, 'aktif') RETURNING id`, bagianID).Scan(&santriID); err != nil {
		t.Fatalf("Santri: %v", err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO mata_pelajaran (kelas_id, tingkatan_id, nama_mapel, kategori) VALUES ($1, $2, 'MB', 'umum') RETURNING id`, kelasID, tingkatanID).Scan(&mapelID); err != nil {
		t.Fatalf("Mapel: %v", err)
	}

	// Khos smt1 = 8.5, smt2 = 7.5 => rata-rata 8.0 => round 8.
	// Bi Ghoirihi (alpha) = 10 pertemuan = 5 hari (ceil ½) => memenuhi ambang ≥5 hari => koreksi -1 => final 7 => المتوسط الأول.
	db.Exec(ctx, `INSERT INTO nilai_khos (santri_id, mapel_id, semester, nilai_akhir) VALUES ($1, $2, 1, 8.5)`, santriID, mapelID)
	db.Exec(ctx, `INSERT INTO nilai_khos (santri_id, mapel_id, semester, nilai_akhir) VALUES ($1, $2, 2, 7.5)`, santriID, mapelID)
	// Pakai tahun_ajaran unik untuk kalender agar tidak bentrok dengan data sisa uji lain
	// (kalender_kuartal unik per kuartal+tahun_ajaran; nilai tahun di sini tidak dipakai kalkulasi Al-Bayan).
	if err := db.QueryRow(ctx, `INSERT INTO kalender_kuartal (tahun_ajaran, kuartal, tgl_mulai, tgl_selesai) VALUES ('TESTBAYAN', 1, $1, $2) RETURNING id`, time.Now(), time.Now()).Scan(&kuartalID); err != nil {
		t.Fatalf("insert kalender_kuartal: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO rekap_absensi (santri_id, kuartal_id, total_izin, total_alpha) VALUES ($1, $2, 0, 10)`, santriID, kuartalID); err != nil {
		t.Fatalf("insert rekap_absensi: %v", err)
	}

	defer func() {
		db.Exec(ctx, `DELETE FROM nilai_bayan WHERE santri_id = $1`, santriID)
		db.Exec(ctx, `DELETE FROM rekap_absensi WHERE santri_id = $1`, santriID)
		db.Exec(ctx, `DELETE FROM nilai_khos WHERE santri_id = $1`, santriID)
		db.Exec(ctx, `DELETE FROM kalender_kuartal WHERE id = $1`, kuartalID)
		db.Exec(ctx, `DELETE FROM santri WHERE id = $1`, santriID)
		db.Exec(ctx, `DELETE FROM mata_pelajaran WHERE id = $1`, mapelID)
		db.Exec(ctx, `DELETE FROM bagian WHERE id = $1`, bagianID)
		db.Exec(ctx, `DELETE FROM kelas WHERE id = $1`, kelasID)
		db.Exec(ctx, `DELETE FROM tingkatan WHERE id = $1`, tingkatanID)
	}()

	if err := GenerateAlBayan(ctx, santriID, "2024/2025"); err != nil {
		t.Fatalf("Failed GenerateAlBayan: %v", err)
	}

	var kategoriID int
	var labelArab string
	db.QueryRow(ctx, `SELECT kategori_id, label_arab FROM nilai_bayan WHERE santri_id = $1 AND tahun_ajaran = '2024/2025'`, santriID).Scan(&kategoriID, &labelArab)

	if kategoriID != 7 {
		t.Errorf("Expected Kategori 7, got %v", kategoriID)
	}
	if labelArab != "المتوسط الأول" {
		t.Errorf("Expected label المتوسط الأول, got %v", labelArab)
	}
}
