# Requirements Document

## Introduction

Dokumen ini menetapkan kebutuhan untuk fitur "Dashboard Redesign & Kalender" pada aplikasi Mubtadiat Manajemen Sistem (backend Go dengan chi + pgx/PostgreSQL, frontend HTML statis + vanilla-JS yang dibangun dengan Vite dan Tailwind v4).

Fitur ini mencakup empat tujuan utama:

1. Menerapkan tema warna baru "Teal Tenang" yang lebih kalem untuk kenyamanan mata, dengan token warna terpusat sehingga konsisten di seluruh halaman dan tetap mendukung mode gelap.
2. Merancang ulang tampilan Dashboard desktop (index.html) dengan hero, kartu statistik, dan area dua kolom berisi grafik CSS murni serta widget.
3. Merancang tampilan Dashboard ponsel (Varian A) yang ringkas namun berkarakter.
4. Membuat Dashboard sadar-peran (role-aware) yang menampilkan konten sesuai peran pengguna, termasuk widget "Jadwal Hari Ini" dengan deep-link ke Input Absensi, serta widget "Kalender & Agenda" berbasis data kuartal yang sudah ada.

Fitur ini memanfaatkan endpoint dan logika RBAC yang SUDAH ADA tanpa membuat tabel agenda baru dan tanpa menambah pustaka chart pihak ketiga.

## Glossary

- **Aplikasi**: Aplikasi Mubtadiat Manajemen Sistem secara keseluruhan (backend Go + frontend Vite).
- **Tema_Teal**: Palet warna "Teal Tenang" yang menggantikan palet biru sebelumnya, didefinisikan sebagai token warna di blok `@theme` pada `frontend/style.css`.
- **Token_Warna**: Kumpulan variabel warna terpusat pada `@theme` (mis. `--color-primary`, `--color-primary-hover`, `--color-light-bg`, `--color-accent-gold`, serta token hero gradient) yang digunakan seluruh halaman.
- **Mode_Gelap**: Mode tampilan gelap Aplikasi yang tetap harus berfungsi setelah penerapan Tema_Teal.
- **Dashboard**: Halaman utama `frontend/index.html` beserta skrip terkait (`frontend/src/js/main.js`).
- **Dashboard_Desktop**: Tampilan Dashboard pada lebar layar desktop.
- **Dashboard_Ponsel**: Tampilan Dashboard pada lebar layar ponsel (Varian A).
- **Viewport_Mobile**: Kondisi lebar layar ponsel (di bawah breakpoint `md` Tailwind).
- **Header_Hero**: Bagian hero pada bagian atas Dashboard (salam, nama, badge peran, tanggal/waktu/hijriah).
- **Bottom_Nav**: Navigasi bawah tetap pada tampilan ponsel yang sudah ada.
- **Tombol_Aksi_Mengambang**: Tombol FAB (floating action button) di tengah Bottom_Nav yang sudah ada (pencarian global).
- **Peran**: Peran pengguna yang login.
- **Peran_Admin**: Kelompok peran pimpinan dan admin. Termasuk mufatish untuk akses baca statistik dan grafik.
- **Peran_Guru**: Kelompok peran mustahiq dan munawwib (pengajar).
- **Jadwal_Hari_Ini**: Widget yang menampilkan daftar jadwal mengajar hari ini untuk Peran_Guru, bersumber dari endpoint `GET /api/akademik/jadwal-saya-hari-ini`.
- **Kalender_Agenda**: Widget yang menampilkan strip minggu 7 hari dan daftar agenda yang bersumber HANYA dari data `kalender_kuartal` (via `/api/kalender` dan `/api/kalender/tahun`) ditambah Jadwal_Hari_Ini.
- **Kartu_Jadwal**: Elemen kartu yang mewakili satu entri jadwal pada widget Jadwal_Hari_Ini.
- **Halaman_Absensi**: Halaman `frontend/absensi.html` beserta skrip `frontend/src/js/absensi.js`.
- **Deep_Link_Absensi**: URL navigasi berbentuk `absensi.html?bagian=<bagian_id>&tanggal=<hari_ini>` yang membuka Halaman_Absensi pada bagian dan tanggal tertentu.
- **RBAC_Absensi**: Aturan kontrol akses yang sudah ada, di mana Peran_Guru hanya dapat melakukan absensi pada kelas yang memiliki jadwal untuk guru tersebut.
- **Endpoint_Statistik**: Endpoint `GET /api/dashboard/stats` yang mengembalikan total_santri, total_bagian, total_alumni, dan input_nilai.
- **Widget_Statistik**: Baris empat kartu statistik pada Dashboard_Desktop, termasuk metrik "Santri Pengabdian".
- **Grafik_Tingkatan**: Bar chart CSS murni "Distribusi Santri per Tingkatan".
- **Grafik_Status**: Donut chart CSS murni "Komposisi Status Santri" (aktif / pengabdian / boyong-keluar / alumni).
- **Empty_State**: Tampilan ramah yang muncul ketika suatu widget tidak memiliki data.

## Requirements

### Requirement 1: Tema warna "Teal Tenang" terpusat

**User Story:** Sebagai pengguna Aplikasi, saya ingin palet warna yang lebih kalem (teal), sehingga tampilan lebih nyaman di mata dan konsisten di seluruh halaman.

#### Acceptance Criteria

1. THE Aplikasi SHALL mendefinisikan `--color-primary` bernilai `#0E7C86` dan `--color-primary-hover` bernilai `#0F6870` pada blok `@theme` di `frontend/style.css`.
2. THE Aplikasi SHALL mendefinisikan token hero gradient dari `#0F6E77` ke `#12A2A8` pada `@theme`.
3. THE Aplikasi SHALL mendefinisikan `--color-light-bg` bernilai `#F5F7F5` dan `--color-accent-gold` bernilai `#E0A93B` pada `@theme`.
4. THE Aplikasi SHALL merender setiap kartu pada seluruh halaman dengan border selebar 1px.
5. THE setiap berkas HTML pada `frontend/` SHALL merujuk Token_Warna dari `@theme` untuk warna primary, hover, hero gradient, background, dan aksen, dan TIDAK menuliskan nilai heksadesimal warna tersebut secara langsung (hardcoded).
6. WHILE Mode_Gelap aktif, THE Aplikasi SHALL menampilkan teks terhadap latarnya dengan rasio kontras minimal 4.5:1 untuk teks normal dan minimal 3:1 untuk teks besar dan elemen antarmuka.
7. IF sebuah Token_Warna tidak tersedia saat render, THEN THE Aplikasi SHALL tetap menampilkan halaman tanpa merusak tata letak (degradasi anggun).

### Requirement 2: Redesign Dashboard Desktop (index.html)

**User Story:** Sebagai Peran_Admin, saya ingin tampilan Dashboard desktop yang informatif dan terstruktur, sehingga saya dapat memantau kondisi pondok dengan cepat.

#### Acceptance Criteria

1. WHILE Dashboard_Desktop ditampilkan, THE Dashboard SHALL menampilkan hero dengan latar gradient teal dan ornamen yang memuat seluruh elemen berikut: teks salam, nama pengguna yang sedang login, badge peran, tanggal masehi, waktu, dan tanggal hijriah.
2. WHILE Dashboard_Desktop ditampilkan, THE Dashboard SHALL memperbarui tampilan waktu pada hero setiap 1 detik.
3. IF nama pengguna atau peran tidak tersedia, THEN THE Dashboard SHALL menampilkan nilai placeholder pada elemen terkait tanpa menghentikan render hero.
4. WHILE Dashboard_Desktop ditampilkan, THE Dashboard SHALL menampilkan Widget_Statistik berupa tepat empat kartu, dan setiap kartu SHALL memuat garis aksen, sebuah badge, dan sebuah nilai metrik numerik.
5. THE Widget_Statistik SHALL menyertakan kartu metrik "Santri Pengabdian" yang menampilkan jumlah santri berstatus pengabdian sebagai bilangan bulat non-negatif.
6. IF nilai suatu metrik tidak tersedia, THEN THE Widget_Statistik SHALL menampilkan angka 0 pada kartu metrik tersebut.
7. WHILE Dashboard_Desktop ditampilkan, THE Dashboard SHALL menampilkan area dua kolom, dengan kolom kiri memuat Grafik_Tingkatan dan Grafik_Status.
8. WHILE Dashboard_Desktop ditampilkan, THE Dashboard SHALL menampilkan pada kolom kanan seluruh bagian berikut: "Akses Cepat", widget Kalender_Agenda, dan "Ringkasan Pengajar".
9. THE Grafik_Tingkatan dan Grafik_Status SHALL dirender menggunakan CSS murni tanpa pustaka chart pihak ketiga.
10. THE Grafik_Status SHALL menampilkan komposisi status santri untuk keempat kategori: aktif, pengabdian, boyong-keluar, dan alumni, dengan ukuran tiap segmen proporsional terhadap jumlah santri pada kategori tersebut relatif terhadap total seluruh kategori.
11. IF total santri pada seluruh kategori bernilai 0, THEN THE Grafik_Status SHALL menampilkan indikasi keadaan kosong tanpa segmen.

### Requirement 3: Dashboard Ponsel (Varian A)

**User Story:** Sebagai pengguna ponsel, saya ingin tampilan Dashboard yang ringkas namun berkarakter, sehingga mudah digunakan pada layar kecil.

#### Acceptance Criteria

1. WHILE Dashboard_Ponsel ditampilkan pada Viewport_Mobile, THE Dashboard SHALL menata seluruh kontennya dalam satu kolom vertikal dan menampilkan Header_Hero dengan sudut membulat beradius minimal 16px pada keempat sudutnya.
2. WHILE Dashboard_Ponsel ditampilkan pada Viewport_Mobile, THE Dashboard SHALL menampilkan kartu ringkasan yang menumpang (overlap) menutupi sebagian tepi bawah Header_Hero, dengan tiga blok ringkasan menumpuk berurutan: Santri, kemudian Khidmah, kemudian Alumni, dan setiap blok menampilkan label serta nilai ringkasan numeriknya.
3. WHILE Dashboard_Ponsel ditampilkan pada Viewport_Mobile, THE Dashboard SHALL menampilkan widget yang diizinkan untuk Peran pengguna tepat di bawah kartu ringkasan, kemudian menampilkan widget Kalender_Agenda tepat di bawah widget peran tersebut.
4. IF Peran pengguna tidak memiliki widget khusus yang diizinkan, THEN THE Dashboard SHALL menampilkan widget Kalender_Agenda langsung di bawah kartu ringkasan tanpa menyisakan area kosong pengganti widget peran.
5. WHILE Dashboard_Ponsel ditampilkan pada Viewport_Mobile, THE Dashboard SHALL menampilkan Bottom_Nav beserta Tombol_Aksi_Mengambang yang identik secara struktur markup dengan halaman lain.
6. WHILE Dashboard_Ponsel ditampilkan pada Viewport_Mobile, THE Dashboard SHALL memberi jarak bawah pada area konten utama sebesar minimal tinggi Bottom_Nav agar widget paling bawah tidak tertutup oleh Bottom_Nav.

### Requirement 4: Dashboard sadar-peran (role-aware)

**User Story:** Sebagai pengguna dengan peran tertentu, saya ingin Dashboard menampilkan konten yang relevan dengan peran saya, sehingga saya melihat informasi yang paling berguna.

#### Acceptance Criteria

1. WHERE pengguna adalah Peran_Admin, THE Dashboard SHALL menampilkan Widget_Statistik, Grafik_Tingkatan, Grafik_Status, dan widget Kalender_Agenda secara bersamaan pada tampilan awal Dashboard.
2. WHERE pengguna adalah Peran_Guru, THE Dashboard SHALL menampilkan widget Jadwal_Hari_Ini pada posisi paling atas area konten (sebelum seluruh widget lain) dan tidak menampilkan Widget_Statistik, Grafik_Tingkatan, maupun Grafik_Status.
3. WHERE pengguna adalah Peran_Guru, THE widget Jadwal_Hari_Ini SHALL menampilkan hanya kelas yang memiliki jadwal untuk guru tersebut pada tanggal berjalan (tanggal server) sesuai RBAC_Absensi, dan tidak menampilkan kelas milik guru lain.
4. IF pengguna adalah Peran_Guru dan tidak memiliki kelas berjadwal pada tanggal berjalan, THEN THE widget Jadwal_Hari_Ini SHALL menampilkan pesan status kosong yang menyatakan tidak ada jadwal hari ini.
5. IF peran pengguna tidak dikenali sebagai Peran_Admin maupun Peran_Guru, THEN THE Dashboard SHALL menampilkan pesan indikasi bahwa konten tidak tersedia untuk peran tersebut dan tidak menampilkan widget apa pun.

### Requirement 5: Widget "Jadwal Hari Ini" dan deep-link ke Input Absensi

**User Story:** Sebagai Peran_Guru, saya ingin melihat jadwal mengajar hari ini dan langsung membuka form absensi dari sana, sehingga saya dapat mencatat kehadiran dengan cepat.

#### Acceptance Criteria

1. WHEN widget Jadwal_Hari_Ini dimuat, THE Dashboard SHALL mengirim permintaan ke endpoint `GET /api/akademik/jadwal-saya-hari-ini` dan SHALL menampilkan hasil dalam waktu maksimal 5 detik sejak permintaan dikirim.
2. WHILE permintaan ke endpoint `GET /api/akademik/jadwal-saya-hari-ini` belum menerima respons, THE widget Jadwal_Hari_Ini SHALL menampilkan indikator status pemuatan (loading).
3. WHEN respons endpoint berhasil diterima dan berisi satu atau lebih entri pada `jadwal[]`, THE widget Jadwal_Hari_Ini SHALL menampilkan setiap entri sebagai satu Kartu_Jadwal terpisah, diurutkan menaik berdasarkan `jam_mulai`.
4. WHEN sebuah Kartu_Jadwal ditampilkan, THE widget Jadwal_Hari_Ini SHALL menampilkan nilai `jam_mulai`, `jam_selesai`, `nama_mapel`, `nama_bagian`, `tingkatan`, dan `kelas` dari entri jadwal terkait.
5. WHEN pengguna mengetuk sebuah Kartu_Jadwal, THE Dashboard SHALL menavigasi ke Deep_Link_Absensi dengan format `absensi.html?bagian=<bagian_id>&tanggal=<hari_ini>`, dengan `<bagian_id>` diisi nilai `bagian_id` dari entri jadwal dan `<hari_ini>` diisi tanggal hari ini dalam format `YYYY-MM-DD`.
6. WHEN Halaman_Absensi dimuat dan URL mengandung query param `bagian` dan `tanggal` yang valid, THE Halaman_Absensi SHALL memanggil fungsi `selectBagian` dengan nilai `bagian` tersebut untuk memuat form absensi bagian dan tanggal terkait tanpa interaksi tambahan dari pengguna.
7. IF Halaman_Absensi dimuat dengan query param `bagian` atau `tanggal` yang tidak ada atau tidak valid, THEN THE Halaman_Absensi SHALL menampilkan form absensi dalam keadaan awal tanpa bagian terpilih dan SHALL menampilkan pesan yang menunjukkan bahwa bagian belum dipilih.
8. IF respons endpoint berhasil diterima namun `jadwal[]` kosong, THEN THE widget Jadwal_Hari_Ini SHALL menampilkan Empty_State berisi pesan yang menyatakan tidak ada jadwal mengajar hari ini.
9. IF permintaan ke endpoint `GET /api/akademik/jadwal-saya-hari-ini` gagal atau tidak menerima respons dalam 5 detik, THEN THE widget Jadwal_Hari_Ini SHALL menampilkan pesan kesalahan yang menyatakan jadwal gagal dimuat dan SHALL menyediakan aksi untuk mencoba memuat ulang.

### Requirement 6: Widget "Kalender & Agenda" (kuartal + jadwal)

**User Story:** Sebagai pengguna Dashboard, saya ingin melihat kalender ringkas dengan agenda yang relevan, sehingga saya mengetahui tanggal penting tanpa perlu membuka halaman lain.

#### Acceptance Criteria

1. WHEN widget Kalender_Agenda dimuat, THE Kalender_Agenda SHALL mengambil data agenda hanya dari `kalender_kuartal` (kolom `tahun_ajaran`, `kuartal`, `tgl_mulai`, `tgl_selesai`) melalui `/api/kalender` dan `/api/kalender/tahun`, ditambah data Jadwal_Hari_Ini, tanpa membaca dari tabel agenda lain.
2. IF permintaan ke `/api/kalender`, `/api/kalender/tahun`, atau sumber Jadwal_Hari_Ini gagal atau tidak merespons dalam 10 detik, THEN THE Kalender_Agenda SHALL menampilkan pesan indikasi kegagalan pemuatan data dan tetap menampilkan strip minggu tanpa titik penanda maupun daftar agenda.
3. WHEN widget Kalender_Agenda selesai memuat data, THE Kalender_Agenda SHALL menampilkan strip minggu berisi tepat tujuh hari berurutan yang mencakup tanggal hari ini, dengan sel tanggal hari ini ditandai secara visual berbeda (highlight) dari enam tanggal lainnya.
4. WHEN strip minggu ditampilkan, THE Kalender_Agenda SHALL menampilkan titik penanda hanya pada tanggal dalam rentang tujuh hari tersebut yang bertepatan dengan `tgl_mulai` atau `tgl_selesai` suatu kuartal atau memiliki entri Jadwal_Hari_Ini, dan tidak menampilkan titik penanda pada tanggal tanpa agenda.
5. WHEN daftar agenda ditampilkan, THE Kalender_Agenda SHALL menampilkan baris daftar hanya untuk tanggal yang memiliki minimal satu agenda dan tidak menampilkan baris untuk tanggal tanpa agenda.
6. IF tidak ada satu pun tanggal beragenda pada rentang tujuh hari yang ditampilkan, THEN THE Kalender_Agenda SHALL menampilkan pesan indikasi bahwa tidak ada agenda pada periode tersebut sebagai ganti daftar agenda.

### Requirement 7: Sumber data widget statistik

**User Story:** Sebagai Peran_Admin, saya ingin metrik statistik dihitung dari data yang sudah ada, sehingga angka pada Dashboard akurat tanpa perlu endpoint baru.

#### Acceptance Criteria

1. WHEN Widget_Statistik dimuat, THE Dashboard SHALL mengambil metrik total_santri, total_bagian, total_alumni, dan input_nilai dari Endpoint_Statistik `GET /api/dashboard/stats` dan menampilkan setiap metrik sebagai nilai bilangan bulat non-negatif tanpa memanggil endpoint baru.
2. WHEN Grafik_Tingkatan dimuat, THE Dashboard SHALL menghitung distribusi santri per tingkatan di sisi klien dari respons `/api/santri` dengan mengelompokkan berdasarkan field `tingkatan_nama`, sehingga jumlah seluruh kelompok sama dengan total santri berstatus aktif pada respons tersebut.
3. WHEN Grafik_Status dimuat, THE Dashboard SHALL menghitung komposisi status santri di sisi klien dari respons `/api/santri` dengan mengelompokkan berdasarkan field `status`, sehingga setiap santri terhitung tepat satu kali pada satu kelompok status.
4. WHEN metrik "Santri Pengabdian" dimuat, THE Dashboard SHALL mengambil jumlah pengabdian dari `/api/pengabdian` dan menampilkannya sebagai nilai bilangan bulat non-negatif.
5. WHEN "Ringkasan Pengajar" dimuat, THE Dashboard SHALL mengambil jumlah pengajar dari `/api/pengajar` dan menampilkannya sebagai nilai bilangan bulat non-negatif.
6. WHERE pengguna adalah Peran_Guru, THE Dashboard SHALL menampilkan konten berbasis Jadwal_Hari_Ini dan TIDAK menampilkan statistik pondok dari Endpoint_Statistik.
7. IF permintaan ke salah satu endpoint (`/api/dashboard/stats`, `/api/santri`, `/api/pengabdian`, atau `/api/pengajar`) gagal atau tidak selesai dalam 10 detik, THEN THE Dashboard SHALL menampilkan indikator kesalahan pada widget terkait, menjaga widget lain yang berhasil dimuat tetap tampil, dan menyediakan aksi muat ulang.
8. IF respons `/api/santri` tidak memuat nilai pada field `tingkatan_nama` atau `status` untuk suatu santri, THEN THE Dashboard SHALL mengelompokkan santri tersebut ke dalam kategori "Tidak Diketahui" pada grafik terkait dan tetap menyertakannya dalam total hitungan.

## Non-Tujuan (Out of Scope)

- Aplikasi TIDAK membuat tabel atau halaman untuk mengelola agenda/acara bebas (CRUD acara). Sumber agenda hanya `kalender_kuartal` yang sudah ada.
- Aplikasi TIDAK menambah pustaka chart pihak ketiga; semua grafik dirender dengan CSS murni.
- Aplikasi TIDAK mengubah logika RBAC_Absensi yang sudah ada; fitur ini hanya memanfaatkannya.
- File preview sementara (`palette-preview.html`, `dashboard-preview.html`, `mobile-preview.html`) di `frontend/` dan `public/dist/` BUKAN bagian deliverable dan akan dihapus di akhir; file tersebut tidak menjadi requirement.
