# Implementation Plan: Santri Pengabdian (Khidmah)

## Overview

Implementasi fitur "Pengabdian" (Khidmah) sebagai tahap antara `aktif` → `pengabdian` → `lulus`. Rencana ini membangun secara inkremental: migrasi skema, fungsi murni backend (validasi, deteksi Kelas_Akhir, koersi status), fungsi transisi transaksional pada model, handler & rute RBAC, lalu perubahan frontend (tab pengabdian, badge profil & riwayat, badge pencarian). Setiap langkah membangun di atas langkah sebelumnya dan diakhiri dengan penyambungan (wiring) ke rute/UI existing. Bahasa: Go (backend) dan JavaScript vanilla (frontend), mengikuti kode yang sudah ada.

## Tasks

- [x] 1. Migrasi skema database untuk status & kolom khidmah
  - [x] 1.1 Buat file migrasi `migrations/020_pengabdian_khidmah.sql`
    - DROP lalu ADD `santri_status_check` agar menerima nilai `pengabdian` di samping `aktif`, `cuti`, `lulus`, `boyong`, `keluar`
    - `ADD COLUMN IF NOT EXISTS` untuk `khidmah_tempat TEXT`, `khidmah_mulai DATE`, `khidmah_selesai DATE` (nullable)
    - `ADD COLUMN IF NOT EXISTS khidmah VARCHAR(255)` pada tabel `alumni` (idempoten)
    - `CREATE INDEX IF NOT EXISTS idx_santri_status ON santri(status)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Tulis smoke test migrasi
    - Insert santri dengan status `pengabdian` sukses; kolom khidmah menerima NULL
    - _Requirements: 1.1, 1.5_

- [x] 2. Fungsi murni backend pada `models/pengabdian.go`
  - [x] 2.1 Implementasikan `IsKelasAkhir` dan `resolveStatusKeluar`
    - `IsKelasAkhir(tingkatanNama, kelasNama)`: tingkatan cocok regex `aliyah` dan kelas cocok token `3` atau kata `tiga` (menyalin aturan `isKelasAkhirAliyah`)
    - `resolveStatusKeluar(status, isAkhir)`: kembalikan `lulus` bila `status=="boyong"` dan `isAkhir`, selain itu kembalikan status apa adanya
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 2.2 Tulis property test koersi status keluar
    - **Property 6: Koersi status keluar berbasis Kelas_Akhir**
    - **Validates: Requirements 4.3, 4.4, 4.5**

  - [x] 2.3 Implementasikan `ValidateMulaiPengabdian` dan `ValidateSelesaiPengabdian`
    - `ValidateMulaiPengabdian`: `khidmah_tempat` non-kosong setelah trim, `khidmah_mulai` non-kosong & format `2006-01-02` valid
    - `ValidateSelesaiPengabdian`: `khidmah_selesai` non-kosong & format tanggal valid
    - Pesan error dalam Bahasa Indonesia sesuai tabel Error Handling
    - _Requirements: 2.6, 2.7, 3.5_

  - [x] 2.4 Tulis property test validasi Mulai_Pengabdian
    - **Property 2: Validasi input Mulai_Pengabdian**
    - **Validates: Requirements 2.6, 2.7**

  - [x] 2.5 Tulis property test validasi Lepas_Pengabdian
    - **Property 5: Validasi input Lepas_Pengabdian**
    - **Validates: Requirements 3.5**

- [x] 3. Tambahkan kolom khidmah pada model Santri
  - [x] 3.1 Perluas struct `Santri` dan pemindaian di `models/santri.go`
    - Tambah field `KhidmahTempat *string`, `KhidmahMulai *time.Time`, `KhidmahSelesai *time.Time`
    - Tambahkan kolom ke konstanta `santriSelectCols` dan daftar `dest` di `scanSantriFull`
    - Pastikan `GetSantriAktif` tetap memfilter `WHERE s.status='aktif'`
    - _Requirements: 1.2, 1.3, 1.4, 6.2, 7.1, 10.1, 10.2, 10.3_

  - [x] 3.2 Tulis unit test model santri
    - `GetSantriByID` mengembalikan data khidmah; `GetSantriAktif` tidak memuat santri `pengabdian`
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 4. Fungsi transisi transaksional pada `models/pengabdian.go`
  - [x] 4.1 Implementasikan `GetKelasAkhirStatus` dan `MulaiPengabdian`
    - `GetKelasAkhirStatus`: ambil tingkatan & kelas terakhir dari `riwayat_bagian`, kembalikan `IsKelasAkhir(...)`
    - `MulaiPengabdian` (transaksi): validasi input → `UPDATE santri SET status='pengabdian', bagian_id=NULL, khidmah_tempat, khidmah_mulai WHERE id=$id AND status='aktif'` (cek RowsAffected=0 → error), tutup `riwayat_bagian` terbuka, tidak menyentuh `alumni`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8_

  - [x] 4.2 Tulis property test invarian Mulai_Pengabdian
    - **Property 1: Invarian pasca Mulai_Pengabdian**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

  - [x] 4.3 Implementasikan `SelesaiPengabdian` dan `GetSantriPengabdian`
    - `SelesaiPengabdian` (transaksi): validasi → `UPDATE santri SET status='lulus', khidmah_selesai WHERE id=$id AND status='pengabdian'` (RowsAffected=0 → error), salin `khidmah_tempat`, `INSERT INTO alumni (santri_id, tahun_lulus, khidmah) ... ON CONFLICT (santri_id) DO NOTHING`
    - `GetSantriPengabdian`: daftar santri `status='pengabdian'` (id, nama, nomor_stambuk, khidmah_tempat, khidmah_mulai) urut nama
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7_

  - [x] 4.4 Tulis property test invarian Lepas_Pengabdian & idempotensi alumni
    - **Property 4: Invarian pasca Lepas_Pengabdian dan idempotensi alumni**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.7**

  - [x] 4.5 Tulis property test guard status awal transisi
    - **Property 3: Guard status awal transisi khidmah**
    - **Validates: Requirements 2.8, 3.6**

- [x] 5. Koersi Kelas_Akhir pada `ProsesKeluarSantri` (`models/alumni.go`)
  - [x] 5.1 Integrasikan `resolveStatusKeluar`/`GetKelasAkhirStatus` sebelum update status
    - Bila `status_akhir=="boyong"` dan santri Kelas_Akhir → koersi ke `lulus`; pertahankan penulisan `proses_keluar` dan `alumni ON CONFLICT DO NOTHING`
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 Tulis example/integration test regresi proses keluar
    - Kelas_Akhir + `lulus` → status lulus + baris alumni; boyong non-Kelas_Akhir → status boyong, muncul di arsip, bukan alumni lulus
    - _Requirements: 4.1, 4.6_

- [x] 6. Sertakan santri pengabdian pada pencarian global (`models/pencarian.go`)
  - [x] 6.1 Perbarui `GlobalSearch` dan `DataUtamaSantri`
    - Ubah query 1 menjadi `... AND s.status IN ('aktif','pengabdian')`, pilih `s.khidmah_tempat`
    - Tambahkan field `KhidmahTempat *string json:"khidmah_tempat,omitempty"` pada `DataUtamaSantri`; tipe hasil tetap `"santri"`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.2 Tulis example test GlobalSearch
    - Santri `pengabdian` muncul di hasil dengan `status` dan `khidmah_tempat`
    - _Requirements: 5.1_

- [x] 7. Checkpoint - Pastikan seluruh test backend lolos
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Handler & rute RBAC pengabdian
  - [x] 8.1 Implementasikan handler dan daftarkan rute
    - `handlers/pengabdian.go`: `MulaiPengabdian` (POST /api/pengabdian/mulai), `SelesaiPengabdian` (POST /api/pengabdian/selesai), `GetPengabdian` (GET /api/pengabdian); decode JSON → panggil model → tulis JSON `{"status":"success",...}`; error validasi/status → 400, error DB → 500
    - `main.go`: grup `/api/pengabdian` — baca (`pimpinan,admin,mufatish`) untuk `GET /`; tulis (`pimpinan,admin`) untuk `POST /mulai`, `POST /selesai` via `RequireRoles`
    - _Requirements: 2.1, 2.6, 2.7, 2.8, 3.1, 3.5, 3.6, 8.5, 9.1, 9.2, 9.3_

  - [x] 8.2 Tulis integration test RBAC rute `/api/pengabdian`
    - Peran_Tulis → 2xx; peran lain → 401/403; Peran_Baca `GET` → 2xx
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 9. Badge pencarian global pengabdian (`frontend/src/js/xss.js`)
  - [x] 9.1 Ekstrak fungsi murni `searchBadgeFor(item)` dan pakai pada `fetchSearchResults`
    - Untuk `tipe==='santri'` dengan `data_utama.status==='pengabdian'` → label `PENGABDIAN` + subteks memuat `khidmah_tempat`; selain itu label `SANTRI`; navigasi tetap ke `profil-santri.html?id=...`
    - Ekspor fungsi agar dapat diimpor oleh test
    - _Requirements: 5.2, 5.3_

  - [x] 9.2 Tulis property test badge pencarian
    - **Property 7: Render hasil pencarian santri pengabdian**
    - **Validates: Requirements 5.2, 5.3**

- [x] 10. Tab Pengabdian pada Halaman Alumni (`frontend/alumni.html`, `frontend/src/js/alumni.js`)
  - [x] 10.1 Tambahkan markup dua tab dan `switchTab`
    - Tombol tab "Pengabdian" & "Alumni" di atas area tabel, dua kontainer daftar; `switchTab('pengabdian'|'alumni')` toggle `hidden`; tab Alumni mempertahankan tabel & modal existing
    - _Requirements: 8.1, 8.4_

  - [x] 10.2 Implementasikan tab Pengabdian dan modal "Selesai Khidmah"
    - `loadPengabdian` (`GET /api/pengabdian`) + fungsi murni `renderPengabdianRow(item)` (nama, khidmah_tempat, khidmah_mulai) + `canShowSelesaiKhidmah(role)` = `isAdminRole(role)`
    - Tombol "Selesai Khidmah → Alumni" per baris bila Peran_Tulis → modal input tanggal selesai → `POST /api/pengabdian/selesai` → reload kedua tab
    - _Requirements: 8.2, 8.3, 8.5_

  - [x] 10.3 Tambahkan alur "Mulai Pengabdian" pada modal Proses Keluar
    - Untuk santri Kelas_Akhir (deteksi via util `isKelasAkhir` bersama): pilihan "Langsung Alumni" (`proses-keluar` lulus) atau "Khidmah dulu" (field khidmah_tempat + khidmah_mulai → `POST /api/pengabdian/mulai`)
    - _Requirements: 4.2_

  - [x] 10.4 Tulis property test baris daftar pengabdian
    - **Property 10: Baris daftar pengabdian memuat field wajib**
    - **Validates: Requirements 8.2**

  - [x] 10.5 Tulis property test gating tombol per peran
    - **Property 11: Gating tombol "Selesai Khidmah → Alumni" per peran**
    - **Validates: Requirements 8.3**

  - [x] 10.6 Tulis example test jsdom Halaman Alumni
    - Kedua tab termuat; tab Alumni tetap merender data; submit modal "Selesai Khidmah" memanggil `POST /api/pengabdian/selesai` (mock fetch)
    - _Requirements: 8.1, 8.4, 8.5_

- [x] 11. Badge & riwayat pengabdian pada Detail Profil (`frontend/profil-santri.html`, `frontend/src/js/profil_santri.js`)
  - [x] 11.1 Tambahkan badge status dan blok Riwayat Pengabdian
    - Tambah entri `pengabdian` pada `statusMap`; fungsi murni `profilStatusLabel(status)` dan `khidmahRiwayatStatus(status)` (`pengabdian`→`Berlangsung`, selain itu `Selesai`)
    - Saat `pengabdian` tampilkan `khidmah_tempat` dekat badge; blok Riwayat Pengabdian tampil bila `khidmah_tempat` terisi (tempat, mulai, selesai → "-" bila kosong, status)
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 7.3, 7.4_

  - [x] 11.2 Tulis property test label status profil
    - **Property 8: Label status pengabdian pada detail profil**
    - **Validates: Requirements 6.1**

  - [x] 11.3 Tulis property test status riwayat pengabdian
    - **Property 9: Status riwayat pengabdian Berlangsung/Selesai**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [x] 11.4 Tulis example test jsdom detail profil
    - Detail profil santri `pengabdian` menampilkan tempat khidmah; `khidmah_selesai` kosong → "-"
    - _Requirements: 6.2, 7.4_

- [x] 12. Checkpoint akhir - Pastikan seluruh test lolos
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Task berlabel `*` bersifat opsional (test) dan dapat dilewati untuk MVP lebih cepat.
- Setiap task merujuk klausa requirement spesifik untuk keterlacakan.
- Property test memvalidasi properti universal (Property 1–11); backend Go memakai generator acak ≥100 iterasi (opsi `testing/quick`) karena tidak ada pustaka PBT terpasang, frontend memakai `fast-check` + jsdom.
- Fungsi murni (validasi, koersi, rendering) diekstrak agar dapat diuji lepas dari DB/DOM.
- Checkpoint memastikan validasi inkremental sebelum lanjut.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "9.1", "10.1", "11.1"] },
    { "id": 1, "tasks": ["2.3", "5.1", "6.1", "10.2", "11.2"] },
    { "id": 2, "tasks": ["4.1", "3.2", "5.2", "2.2", "9.2", "10.3"] },
    { "id": 3, "tasks": ["4.3", "6.2", "2.4", "11.3", "10.4"] },
    { "id": 4, "tasks": ["8.1", "4.2", "1.2", "11.4", "10.5"] },
    { "id": 5, "tasks": ["8.2", "2.5", "10.6"] },
    { "id": 6, "tasks": ["4.4"] },
    { "id": 7, "tasks": ["4.5"] }
  ]
}
```
