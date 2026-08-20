# Requirements Document

## Introduction

Fitur ini menambahkan tahap **"Pengabdian" (Khidmah)** pada aplikasi "Mubtadiat Manajemen Sistem". Pengabdian adalah tahap antara status `aktif` dan status alumni (`lulus`) bagi lulusan kelas 3 Aliyah yang memilih berkhidmah terlebih dahulu sebelum resmi menjadi alumni. Khidmah bersifat sukarela: lulusan boleh langsung menjadi alumni (`lulus`) atau menempuh pengabdian dulu (`pengabdian`) lalu menjadi alumni.

Ruang lingkup mencakup penambahan status baru dan kolom khidmah pada tabel `santri`, transisi status (mulai pengabdian dan lepas ke alumni), aturan penentuan `lulus` versus `boyong`/`keluar` berdasarkan tingkat kelas, penampilan penanda "Pengabdian" beserta tempat khidmah pada pencarian global dan halaman detail profil, riwayat pengabdian pada detail profil, tab "Pengabdian" pada halaman Alumni, serta kontrol akses berbasis peran.

### Non-Tujuan (Out of Scope)

- Tidak mengubah alur absensi maupun penilaian yang sudah ada.
- Tidak menambah master data tempat khidmah (tempat khidmah dicatat sebagai teks bebas).
- Tidak mendukung banyak periode/tempat khidmah untuk satu santri (hanya satu tempat khidmah aktif).

## Glossary

- **Sistem**: Aplikasi backend "Mubtadiat Manajemen Sistem" (Go + PostgreSQL) beserta antarmuka frontend statisnya.
- **Santri**: Peserta didik yang tercatat pada tabel `santri`.
- **Status_Santri**: Kolom `santri.status` yang bernilai salah satu dari `aktif`, `cuti`, `pengabdian`, `lulus`, `boyong`, atau `keluar`.
- **Pengabdian**: Nilai status `pengabdian` pada `santri.status`, menandakan santri sedang menempuh khidmah sebagai tahap antara sebelum menjadi alumni.
- **Alumni**: Santri yang memiliki baris pada tabel `alumni`. Dalam konteks status, alumni ditandai dengan `santri.status = 'lulus'`.
- **Kelas_Akhir**: Tingkat kelas tertinggi yaitu kelas 3 Aliyah, penanda bahwa santri telah menuntaskan jenjang pendidikan.
- **Khidmah_Tempat**: Kolom teks bebas `santri.khidmah_tempat` berisi nama tempat santri berkhidmah.
- **Khidmah_Mulai**: Kolom tanggal `santri.khidmah_mulai` berisi tanggal santri mulai berkhidmah.
- **Khidmah_Selesai**: Kolom tanggal `santri.khidmah_selesai` berisi tanggal santri selesai berkhidmah.
- **Mulai_Pengabdian**: Aksi transisi status dari `aktif` menjadi `pengabdian`.
- **Lepas_Pengabdian**: Aksi transisi status dari `pengabdian` menjadi `lulus` (menjadi alumni).
- **Halaman_Alumni**: Halaman frontend `alumni.html` beserta skrip `src/js/alumni.js`.
- **Detail_Profil**: Halaman frontend `profil-santri.html` beserta skrip `src/js/profil_santri.js`.
- **Pencarian_Global**: Fitur pencarian lintas halaman yang mengelompokkan hasil menjadi tipe `santri`, `alumni`, atau `pengajar`.
- **Peran_Tulis**: Peran yang berwenang melakukan aksi tulis khidmah, yaitu `admin` dan `pimpinan`.
- **Peran_Baca**: Peran yang berwenang membaca data pengabdian, yaitu `pimpinan`, `admin`, dan `mufatish`.

## Requirements

### Requirement 1: Model Status dan Kolom Khidmah

**User Story:** Sebagai admin, saya ingin sistem menyimpan status "pengabdian" dan data khidmah pada data santri, sehingga tahap khidmah dapat dilacak sebelum santri menjadi alumni.

#### Acceptance Criteria

1. THE Sistem SHALL menerima nilai `pengabdian` sebagai salah satu nilai sah dari Status_Santri di samping nilai `aktif`, `cuti`, `lulus`, `boyong`, dan `keluar`.
2. THE Sistem SHALL menyediakan kolom Khidmah_Tempat bertipe teks pada tabel `santri`.
3. THE Sistem SHALL menyediakan kolom Khidmah_Mulai bertipe tanggal pada tabel `santri`.
4. THE Sistem SHALL menyediakan kolom Khidmah_Selesai bertipe tanggal pada tabel `santri`.
5. THE Sistem SHALL mengizinkan Khidmah_Tempat, Khidmah_Mulai, dan Khidmah_Selesai bernilai kosong untuk santri yang belum pernah menempuh pengabdian.
6. THE Sistem SHALL menyimpan paling banyak satu Khidmah_Tempat aktif untuk setiap Santri.

### Requirement 2: Transisi Mulai Pengabdian

**User Story:** Sebagai admin, saya ingin memindahkan lulusan kelas 3 Aliyah ke status pengabdian saat mereka memilih berkhidmah, sehingga khidmah mereka tercatat sebelum diresmikan sebagai alumni.

#### Acceptance Criteria

1. WHEN Peran_Tulis melakukan Mulai_Pengabdian pada Santri yang berada di Kelas_Akhir, THE Sistem SHALL mengubah Status_Santri menjadi `pengabdian`.
2. WHEN Mulai_Pengabdian berhasil, THE Sistem SHALL mengosongkan `santri.bagian_id` menjadi NULL.
3. WHEN Mulai_Pengabdian berhasil, THE Sistem SHALL menutup riwayat kelas terakhir dengan mengisi `riwayat_bagian.tanggal_selesai` pada baris yang tanggal selesainya masih kosong.
4. WHEN Mulai_Pengabdian berhasil, THE Sistem SHALL menyimpan nilai Khidmah_Tempat dan Khidmah_Mulai yang diberikan pengguna.
5. WHEN Mulai_Pengabdian berhasil, THE Sistem SHALL tidak membuat baris pada tabel `alumni`.
6. IF permintaan Mulai_Pengabdian tidak menyertakan Khidmah_Tempat, THEN THE Sistem SHALL menolak permintaan dan mengembalikan pesan kesalahan yang menjelaskan bahwa tempat khidmah wajib diisi.
7. IF permintaan Mulai_Pengabdian tidak menyertakan Khidmah_Mulai, THEN THE Sistem SHALL menolak permintaan dan mengembalikan pesan kesalahan yang menjelaskan bahwa tanggal mulai khidmah wajib diisi.
8. IF Mulai_Pengabdian ditujukan pada Santri yang Status_Santri-nya bukan `aktif`, THEN THE Sistem SHALL menolak permintaan dan mengembalikan pesan kesalahan.

### Requirement 3: Transisi Lepas Pengabdian ke Alumni

**User Story:** Sebagai admin, saya ingin meresmikan santri yang telah menyelesaikan khidmah menjadi alumni, sehingga data khidmah tersimpan pada arsip alumni.

#### Acceptance Criteria

1. WHEN Peran_Tulis melakukan Lepas_Pengabdian pada Santri berstatus `pengabdian`, THE Sistem SHALL mengubah Status_Santri menjadi `lulus`.
2. WHEN Lepas_Pengabdian berhasil, THE Sistem SHALL membuat satu baris pada tabel `alumni` untuk Santri tersebut dengan `tahun_lulus` terisi.
3. WHEN Lepas_Pengabdian berhasil, THE Sistem SHALL menyalin nilai Khidmah_Tempat Santri ke kolom `alumni.khidmah`.
4. WHEN Lepas_Pengabdian berhasil, THE Sistem SHALL mengisi Khidmah_Selesai dengan tanggal selesai yang diberikan pengguna.
5. IF permintaan Lepas_Pengabdian tidak menyertakan tanggal selesai khidmah, THEN THE Sistem SHALL menolak permintaan dan mengembalikan pesan kesalahan yang menjelaskan bahwa tanggal selesai khidmah wajib diisi.
6. IF Lepas_Pengabdian ditujukan pada Santri yang Status_Santri-nya bukan `pengabdian`, THEN THE Sistem SHALL menolak permintaan dan mengembalikan pesan kesalahan.
7. IF sudah terdapat baris `alumni` untuk Santri tersebut, THEN THE Sistem SHALL mempertahankan baris yang ada tanpa menggandakannya.

### Requirement 4: Aturan Lulus Langsung dan Boyong/Keluar Berdasarkan Kelas

**User Story:** Sebagai admin, saya ingin sistem membedakan lulusan dari yang keluar sebelum tamat, sehingga hanya yang menyelesaikan Kelas_Akhir yang tercatat sebagai lulus/alumni.

#### Acceptance Criteria

1. WHEN Peran_Tulis memproses keluar Santri di Kelas_Akhir dengan pilihan "langsung alumni", THE Sistem SHALL mengubah Status_Santri menjadi `lulus` dan membuat baris `alumni` dengan `tahun_lulus` terisi.
2. WHEN Peran_Tulis memproses keluar Santri di Kelas_Akhir dengan pilihan "khidmah dulu", THE Sistem SHALL menjalankan Mulai_Pengabdian sesuai Requirement 2.
3. WHEN Peran_Tulis memproses status `boyong` pada Santri yang telah menuntaskan Kelas_Akhir, THE Sistem SHALL mengubah Status_Santri menjadi `lulus` dan memperlakukannya sebagai alumni.
4. WHEN Peran_Tulis memproses status `boyong` pada Santri yang belum menuntaskan Kelas_Akhir, THE Sistem SHALL mengubah Status_Santri menjadi `boyong` dan tidak memperlakukannya sebagai alumni lulus.
5. WHEN Peran_Tulis memproses status `keluar` pada Santri yang belum menuntaskan Kelas_Akhir, THE Sistem SHALL mengubah Status_Santri menjadi `keluar` dan tidak memperlakukannya sebagai alumni lulus.
6. WHERE Santri berstatus `boyong` atau `keluar` sebelum Kelas_Akhir, THE Sistem SHALL menampilkan Santri tersebut pada arsip dan bukan pada daftar alumni lulus.

### Requirement 5: Penanda Pengabdian pada Pencarian Global

**User Story:** Sebagai pengguna staf, saya ingin melihat penanda "Pengabdian" beserta tempat khidmah pada hasil pencarian, sehingga saya dapat membedakan santri pengabdian dari santri aktif maupun alumni.

#### Acceptance Criteria

1. WHEN Pencarian_Global menemukan Santri berstatus `pengabdian`, THE Sistem SHALL menyertakan Santri tersebut pada hasil pencarian.
2. WHEN Pencarian_Global menampilkan Santri berstatus `pengabdian`, THE Sistem SHALL menampilkan penanda "Pengabdian" dan bukan penanda "Aktif" atau "Alumni".
3. WHEN Pencarian_Global menampilkan Santri berstatus `pengabdian`, THE Sistem SHALL menyertakan Khidmah_Tempat pada hasil.

### Requirement 6: Penanda dan Tempat Khidmah pada Detail Profil

**User Story:** Sebagai pengguna staf, saya ingin melihat status pengabdian dan tempat khidmah pada halaman detail profil santri, sehingga kondisi terkini santri jelas terlihat.

#### Acceptance Criteria

1. WHILE Santri berstatus `pengabdian`, THE Detail_Profil SHALL menampilkan penanda "Pengabdian" dan bukan penanda "Aktif" atau "Alumni".
2. WHILE Santri berstatus `pengabdian`, THE Detail_Profil SHALL menampilkan Khidmah_Tempat.

### Requirement 7: Riwayat Pengabdian pada Detail Profil

**User Story:** Sebagai pengguna staf, saya ingin melihat riwayat pengabdian pada detail profil santri, sehingga jejak khidmah tetap terlihat meski santri sudah menjadi alumni.

#### Acceptance Criteria

1. WHERE Santri memiliki data khidmah, THE Detail_Profil SHALL menampilkan riwayat pengabdian yang memuat Khidmah_Tempat, Khidmah_Mulai, Khidmah_Selesai, dan status khidmah.
2. WHILE Santri berstatus `pengabdian`, THE Detail_Profil SHALL menampilkan status riwayat pengabdian sebagai "Berlangsung".
3. WHERE Santri telah menjadi alumni `lulus` dan pernah menempuh pengabdian, THE Detail_Profil SHALL tetap menampilkan riwayat pengabdian beserta Khidmah_Selesai.
4. WHERE Khidmah_Selesai belum terisi, THE Detail_Profil SHALL menampilkan tanggal selesai sebagai "-".

### Requirement 8: Tab Pengabdian pada Halaman Alumni

**User Story:** Sebagai admin, saya ingin halaman Alumni memiliki tab Pengabdian dan tab Alumni, sehingga saya dapat mengelola santri pengabdian dan alumni dari satu tempat.

#### Acceptance Criteria

1. THE Halaman_Alumni SHALL menyediakan tab "Pengabdian" dan tab "Alumni".
2. WHEN pengguna membuka tab "Pengabdian", THE Halaman_Alumni SHALL menampilkan daftar Santri berstatus `pengabdian` yang memuat nama, Khidmah_Tempat, dan Khidmah_Mulai.
3. WHEN pengguna membuka tab "Pengabdian" sebagai Peran_Tulis, THE Halaman_Alumni SHALL menampilkan tombol "Selesai Khidmah → Alumni" untuk setiap Santri berstatus `pengabdian`.
4. WHEN pengguna membuka tab "Alumni", THE Halaman_Alumni SHALL menampilkan daftar alumni `lulus` seperti perilaku yang ada saat ini.
5. WHEN Peran_Tulis menekan tombol "Selesai Khidmah → Alumni" dan mengonfirmasi tanggal selesai, THE Sistem SHALL menjalankan Lepas_Pengabdian sesuai Requirement 3.

### Requirement 9: Kontrol Akses Berbasis Peran

**User Story:** Sebagai pimpinan, saya ingin membatasi aksi tulis khidmah hanya untuk admin dan pimpinan, sehingga integritas data pengabdian terjaga mengikuti pola RBAC yang sudah ada.

#### Acceptance Criteria

1. WHEN Peran_Tulis meminta Mulai_Pengabdian, Lepas_Pengabdian, atau penyuntingan Khidmah_Tempat, THE Sistem SHALL mengizinkan permintaan tersebut.
2. IF pengguna selain Peran_Tulis meminta Mulai_Pengabdian, Lepas_Pengabdian, atau penyuntingan Khidmah_Tempat, THEN THE Sistem SHALL menolak permintaan dengan status tidak berwenang.
3. WHEN Peran_Baca meminta pembacaan daftar atau detail data pengabdian, THE Sistem SHALL mengizinkan permintaan tersebut.

### Requirement 10: Pengecualian dari Kelas Aktif, Absensi, dan Penilaian

**User Story:** Sebagai pengguna staf, saya ingin santri pengabdian tidak muncul di daftar kelas aktif, absensi, dan penilaian, sehingga daftar operasional harian tetap berisi santri aktif saja.

#### Acceptance Criteria

1. WHILE Santri berstatus `pengabdian`, THE Sistem SHALL tidak menyertakan Santri tersebut pada daftar santri aktif.
2. WHILE Santri berstatus `pengabdian`, THE Sistem SHALL tidak menyertakan Santri tersebut pada daftar absensi.
3. WHILE Santri berstatus `pengabdian`, THE Sistem SHALL tidak menyertakan Santri tersebut pada daftar penilaian.
