package models

import (
	"context"
	"testing"
)

// TestProsesKeluarKoersiKelasAkhir adalah example/integration test regresi untuk
// ProsesKeluarSantri setelah penambahan koersi Kelas_Akhir (Requirement 4.1, 4.6).
//
// Skenario:
//  1. Santri Kelas_Akhir (Aliyah / kelas "3") diproses dengan status_akhir='lulus'
//     → santri.status menjadi 'lulus' dan terdapat baris alumni.
//  2. Santri BUKAN Kelas_Akhir (mis. Tsanawiyah / kelas "1") diproses dengan
//     status_akhir='boyong' → santri.status tetap 'boyong' (tidak dikoersi ke
//     lulus), muncul pada GetArsipSantri('boyong'), dan tidak diperlakukan sebagai
//     alumni 'lulus'.
func TestProsesKeluarKoersiKelasAkhir(t *testing.T) {
	db := setupTestDB()
	defer db.Close()
	ctx := context.Background()

	// Bersihkan tabel terkait agar test deterministik.
	db.Exec(ctx, "TRUNCATE tingkatan, kelas, bagian, santri, riwayat_bagian, proses_keluar, alumni CASCADE")

	// ---- Kasus 1: Kelas_Akhir (Aliyah / kelas 3) + lulus ----
	var tingkatanAliyahID, kelasTigaID, bagianAkhirID, santriLulusID int
	if err := db.QueryRow(ctx,
		`INSERT INTO tingkatan (nama, urutan) VALUES ('Aliyah', 3) RETURNING id`).Scan(&tingkatanAliyahID); err != nil {
		t.Fatalf("insert tingkatan Aliyah: %v", err)
	}
	if err := db.QueryRow(ctx,
		`INSERT INTO kelas (nama, tahun_masuk) VALUES ('3', '2021') RETURNING id`).Scan(&kelasTigaID); err != nil {
		t.Fatalf("insert kelas 3: %v", err)
	}
	if err := db.QueryRow(ctx,
		`INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1, $2, 'Aliyah-3A') RETURNING id`,
		kelasTigaID, tingkatanAliyahID).Scan(&bagianAkhirID); err != nil {
		t.Fatalf("insert bagian akhir: %v", err)
	}
	if err := db.QueryRow(ctx,
		`INSERT INTO santri (nik, stambuk, nama, bagian_id, status) VALUES ('AKH1', 'STB-AKH1', 'Santri Kelas Akhir', $1, 'aktif') RETURNING id`,
		bagianAkhirID).Scan(&santriLulusID); err != nil {
		t.Fatalf("insert santri kelas akhir: %v", err)
	}
	db.Exec(ctx,
		`INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai) VALUES ($1, $2, CURRENT_DATE)`,
		santriLulusID, bagianAkhirID)

	if err := ProsesKeluarSantri(ctx, ProsesKeluarInput{
		SantriID:      santriLulusID,
		StatusAkhir:   "lulus",
		TanggalKeluar: "2024-06-01",
		Alasan:        "Lulus Aliyah",
	}); err != nil {
		t.Fatalf("ProsesKeluarSantri (lulus) gagal: %v", err)
	}

	var statusLulus string
	db.QueryRow(ctx, `SELECT status FROM santri WHERE id = $1`, santriLulusID).Scan(&statusLulus)
	if statusLulus != "lulus" {
		t.Errorf("Kasus 1: harap status 'lulus', dapat '%s'", statusLulus)
	}

	var alumniLulusCount int
	db.QueryRow(ctx, `SELECT COUNT(*) FROM alumni WHERE santri_id = $1`, santriLulusID).Scan(&alumniLulusCount)
	if alumniLulusCount != 1 {
		t.Errorf("Kasus 1: harap 1 baris alumni, dapat %d", alumniLulusCount)
	}

	// ---- Kasus 2: BUKAN Kelas_Akhir (Tsanawiyah / kelas 1) + boyong ----
	var tingkatanTsanawiyahID, kelasSatuID, bagianAwalID, santriBoyongID int
	if err := db.QueryRow(ctx,
		`INSERT INTO tingkatan (nama, urutan) VALUES ('Tsanawiyah', 1) RETURNING id`).Scan(&tingkatanTsanawiyahID); err != nil {
		t.Fatalf("insert tingkatan Tsanawiyah: %v", err)
	}
	if err := db.QueryRow(ctx,
		`INSERT INTO kelas (nama, tahun_masuk) VALUES ('1', '2023') RETURNING id`).Scan(&kelasSatuID); err != nil {
		t.Fatalf("insert kelas 1: %v", err)
	}
	if err := db.QueryRow(ctx,
		`INSERT INTO bagian (kelas_id, tingkatan_id, nama_bagian) VALUES ($1, $2, 'Tsanawiyah-1A') RETURNING id`,
		kelasSatuID, tingkatanTsanawiyahID).Scan(&bagianAwalID); err != nil {
		t.Fatalf("insert bagian awal: %v", err)
	}
	if err := db.QueryRow(ctx,
		`INSERT INTO santri (nik, stambuk, nama, bagian_id, status) VALUES ('BOY1', 'STB-BOY1', 'Santri Boyong', $1, 'aktif') RETURNING id`,
		bagianAwalID).Scan(&santriBoyongID); err != nil {
		t.Fatalf("insert santri boyong: %v", err)
	}
	db.Exec(ctx,
		`INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai) VALUES ($1, $2, CURRENT_DATE)`,
		santriBoyongID, bagianAwalID)

	if err := ProsesKeluarSantri(ctx, ProsesKeluarInput{
		SantriID:      santriBoyongID,
		StatusAkhir:   "boyong",
		TanggalKeluar: "2024-06-01",
		Alasan:        "Pindah pondok",
	}); err != nil {
		t.Fatalf("ProsesKeluarSantri (boyong) gagal: %v", err)
	}

	// Status tetap 'boyong' (TIDAK dikoersi ke lulus karena bukan Kelas_Akhir).
	var statusBoyong string
	db.QueryRow(ctx, `SELECT status FROM santri WHERE id = $1`, santriBoyongID).Scan(&statusBoyong)
	if statusBoyong != "boyong" {
		t.Errorf("Kasus 2: harap status 'boyong', dapat '%s'", statusBoyong)
	}

	// Muncul pada arsip boyong.
	arsip, err := GetArsipSantri(ctx, "boyong", "admin", 0)
	if err != nil {
		t.Fatalf("GetArsipSantri('boyong') gagal: %v", err)
	}
	foundInArsip := false
	for _, s := range arsip {
		if s.ID == santriBoyongID {
			foundInArsip = true
			if s.Status != "boyong" {
				t.Errorf("Kasus 2: arsip status harus 'boyong', dapat '%s'", s.Status)
			}
		}
	}
	if !foundInArsip {
		t.Errorf("Kasus 2: santri boyong tidak ditemukan di GetArsipSantri('boyong')")
	}

	// Tidak diperlakukan sebagai alumni 'lulus': tidak muncul pada daftar alumni
	// yang difilter status 'lulus'.
	alumniLulus, err := GetAllAlumni(ctx, AlumniFilter{StatusAkhir: "lulus"})
	if err != nil {
		t.Fatalf("GetAllAlumni(lulus) gagal: %v", err)
	}
	for _, a := range alumniLulus {
		if a.SantriID == santriBoyongID {
			t.Errorf("Kasus 2: santri boyong tidak boleh muncul sebagai alumni 'lulus'")
		}
	}
}
