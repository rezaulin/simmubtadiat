# Requirements Document

## Introduction

Fitur ini bertujuan memperbaiki dan menstandarkan tampilan aplikasi web **Mubtadiaat** (sistem informasi madrasah/pesantren) ketika diakses melalui perangkat seluler (HP). Saat ini pengalaman mobile belum konsisten antar halaman: komponen navigasi (drawer sidebar dan bottom navigation) hanya tersedia lengkap di sebagian halaman, tabel lebar sulit dibaca di layar kecil, serta ukuran target sentuh dan tata letak form/modal belum dioptimalkan untuk sentuhan.

Ruang lingkup fitur ini adalah lapisan tampilan (HTML markup + kelas Tailwind CSS + perilaku JavaScript vanilla yang sudah ada, mis. `xss.js`). Fitur ini TIDAK mengubah logika bisnis backend Go, skema data, maupun kontrol akses berbasis peran (RBAC) yang sudah ada; fitur ini hanya memastikan hasil RBAC ditampilkan dengan benar pada komponen navigasi mobile.

Halaman yang tercakup: `index.html` (dashboard), `santri.html`, `perpindahan.html`, `kelas.html`, `penilaian.html`, `absensi.html`, `rapot.html`, `pengajar.html`, `dewan-harian.html`, `arsip.html`, `alumni.html`, `laporan.html`, `rekap.html`, `settings.html`, `profil-santri.html`, `login.html`, `change-password.html`.

Halaman prioritas (paling sering diakses via HP): `index.html`, `absensi.html`, `rapot.html`, `rekap.html`, `profil-santri.html`.

## Glossary

- **Aplikasi**: Aplikasi web Mubtadiaat yang disajikan sebagai halaman HTML statis hasil build Vite dari `public/dist`.
- **Sistem_Tampilan**: Lapisan antarmuka pengguna (markup HTML, kelas Tailwind CSS, dan skrip UI seperti `xss.js`) yang bertanggung jawab atas penyajian visual dan interaksi pada semua halaman.
- **Viewport_Mobile**: Kondisi lebar viewport kurang dari 768px (di bawah breakpoint `md` Tailwind), yang dianggap sebagai tampilan HP.
- **Viewport_Desktop**: Kondisi lebar viewport 768px atau lebih (breakpoint `md` Tailwind ke atas).
- **Breakpoint**: Titik henti responsif bawaan Tailwind CSS yang digunakan konsisten oleh Aplikasi: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px).
- **Drawer_Sidebar**: Panel navigasi samping kiri yang bersifat tetap (fixed) pada Viewport_Desktop dan tampil sebagai laci geser (drawer) yang dibuka melalui tombol hamburger pada Viewport_Mobile. Ditandai dengan elemen `aside#app-sidebar`.
- **Backdrop_Sidebar**: Lapisan latar gelap semi-transparan (`#sidebar-backdrop`) yang muncul di belakang Drawer_Sidebar saat drawer terbuka pada Viewport_Mobile.
- **Top_Bar_Mobile**: Bilah atas yang hanya tampil pada Viewport_Mobile, memuat tombol hamburger (`#btn-open-sidebar`), judul aplikasi, dan tombol aksi (mis. `#theme-toggle-mobile`).
- **Bottom_Nav**: Bilah navigasi bawah yang tetap (fixed) dan hanya tampil pada Viewport_Mobile, memuat pintasan halaman utama beserta Tombol_Aksi_Mengambang.
- **Tombol_Aksi_Mengambang**: Tombol berbentuk lingkaran (Floating Action Button / FAB) yang berada di tengah Bottom_Nav, digunakan untuk aksi utama (mis. pencarian global).
- **Komponen_Tabel_Lebar**: Tabel data dengan banyak kolom yang lebar kontennya melebihi lebar Viewport_Mobile (mis. rekap absensi, leger nilai, data santri).
- **Komponen_Form**: Kumpulan elemen input, select, dan tombol untuk memasukkan atau menyaring data.
- **Komponen_Modal**: Dialog overlay yang muncul di atas konten halaman (mis. modal pencarian `#search-modal`, modal tambah/edit data).
- **Header_Hero**: Kartu header utama halaman yang menonjol secara visual (mis. kartu sambutan pada dashboard).
- **Target_Sentuh**: Area elemen interaktif (tombol, tautan, ikon aksi) yang dapat disentuh pengguna.
- **Peran**: Peran pengguna dalam Aplikasi, yaitu `pimpinan`, `admin`, `mufatish`, `mustahiq`, `munawwib`, atau `wali_santri`.

## Requirements

### Requirement 1: Konsistensi Komponen Navigasi Antar Halaman

**User Story:** Sebagai pengguna yang mengakses aplikasi lewat HP, saya ingin komponen navigasi yang sama tersedia di setiap halaman, sehingga saya dapat berpindah halaman dengan cara yang konsisten tanpa kebingungan.

#### Acceptance Criteria

1. THE Sistem_Tampilan SHALL menyediakan Drawer_Sidebar dengan penanda `aside#app-sidebar`, tombol tutup `#btn-close-sidebar`, dan `#sidebar-backdrop` pada setiap halaman aplikasi kecuali `login.html` dan `change-password.html`.
2. THE Sistem_Tampilan SHALL menyediakan Top_Bar_Mobile dengan tombol hamburger `#btn-open-sidebar` pada setiap halaman aplikasi kecuali `login.html` dan `change-password.html`.
3. THE Sistem_Tampilan SHALL menyediakan Bottom_Nav pada setiap halaman aplikasi kecuali `login.html` dan `change-password.html`.
4. THE Sistem_Tampilan SHALL menggunakan struktur markup, ikon, dan kelas Tailwind yang sama untuk Drawer_Sidebar, Top_Bar_Mobile, dan Bottom_Nav di seluruh halaman yang tercakup.
5. WHILE Aplikasi ditampilkan pada Viewport_Desktop, THE Sistem_Tampilan SHALL menampilkan Drawer_Sidebar dalam keadaan tetap (fixed) dan menyembunyikan Top_Bar_Mobile serta Bottom_Nav.
6. WHILE Aplikasi ditampilkan pada Viewport_Mobile, THE Sistem_Tampilan SHALL menyembunyikan Drawer_Sidebar dalam keadaan tergeser keluar layar dan menampilkan Top_Bar_Mobile serta Bottom_Nav.

### Requirement 2: Perilaku Drawer Sidebar di Mobile

**User Story:** Sebagai pengguna HP, saya ingin membuka dan menutup menu samping dengan mudah, sehingga saya dapat mengakses seluruh menu tanpa menghalangi konten.

#### Acceptance Criteria

1. WHEN pengguna menekan tombol hamburger `#btn-open-sidebar` pada Viewport_Mobile, THE Sistem_Tampilan SHALL menggeser Drawer_Sidebar masuk ke layar dan menampilkan Backdrop_Sidebar.
2. WHEN pengguna menekan tombol tutup `#btn-close-sidebar` pada Viewport_Mobile, THE Sistem_Tampilan SHALL menggeser Drawer_Sidebar keluar layar dan menyembunyikan Backdrop_Sidebar.
3. WHEN pengguna menyentuh Backdrop_Sidebar pada Viewport_Mobile, THE Sistem_Tampilan SHALL menutup Drawer_Sidebar.
4. WHEN pengguna menekan tombol Escape saat Drawer_Sidebar terbuka, THE Sistem_Tampilan SHALL menutup Drawer_Sidebar.
5. WHEN pengguna menyentuh salah satu tautan navigasi di dalam Drawer_Sidebar pada Viewport_Mobile, THE Sistem_Tampilan SHALL menutup Drawer_Sidebar.
6. WHILE Drawer_Sidebar terbuka pada Viewport_Mobile, THE Sistem_Tampilan SHALL mencegah konten latar di belakang drawer bergulir (scroll lock).
7. WHEN lebar viewport berubah dari Viewport_Mobile menjadi Viewport_Desktop, THE Sistem_Tampilan SHALL menyembunyikan Backdrop_Sidebar dan mengembalikan Drawer_Sidebar ke keadaan tetap desktop.

### Requirement 3: Navigasi Bawah dan Tombol Aksi Mengambang

**User Story:** Sebagai pengguna HP, saya ingin pintasan ke halaman utama selalu berada dalam jangkauan ibu jari, sehingga saya dapat berpindah halaman dengan cepat menggunakan satu tangan.

#### Acceptance Criteria

1. WHILE Aplikasi ditampilkan pada Viewport_Mobile, THE Bottom_Nav SHALL tetap menempel di bagian bawah layar (fixed) saat konten halaman digulir.
2. THE Bottom_Nav SHALL menampilkan tautan pintasan ke halaman utama beserta satu Tombol_Aksi_Mengambang di posisi tengah.
3. WHEN halaman aktif termuat pada Viewport_Mobile, THE Bottom_Nav SHALL menandai secara visual tautan yang sesuai dengan halaman aktif.
4. THE Sistem_Tampilan SHALL memberi jarak bawah (padding) pada area konten utama sebesar minimal tinggi Bottom_Nav agar konten paling bawah tidak tertutup oleh Bottom_Nav.
5. WHERE perangkat memiliki area aman bawah (safe area), THE Bottom_Nav SHALL menambahkan jarak aman bawah agar tidak tertutup oleh elemen sistem perangkat.

### Requirement 4: Konsistensi Kontrol Akses pada Navigasi Mobile

**User Story:** Sebagai pengguna dengan peran tertentu, saya ingin hanya melihat menu yang boleh saya akses baik di sidebar maupun navigasi bawah, sehingga tampilan mobile tidak menampilkan menu yang tidak relevan bagi peran saya.

#### Acceptance Criteria

1. WHEN Peran pengguna telah ditentukan, THE Sistem_Tampilan SHALL menampilkan pada Bottom_Nav hanya tautan halaman yang diizinkan untuk Peran tersebut.
2. WHEN Peran pengguna telah ditentukan, THE Sistem_Tampilan SHALL menyembunyikan pada Drawer_Sidebar dan Bottom_Nav setiap tautan halaman yang tidak diizinkan untuk Peran tersebut.
3. THE Sistem_Tampilan SHALL menggunakan daftar izin menu (menu access) yang identik antara halaman satu dengan halaman lainnya untuk setiap Peran.
4. WHILE data Peran belum selesai dimuat, THE Sistem_Tampilan SHALL menjaga tautan navigasi tetap tidak terlihat hingga daftar tautan yang diizinkan selesai ditentukan.

### Requirement 5: Keterbacaan Tabel Lebar di Layar Kecil

**User Story:** Sebagai pengguna HP yang membuka rekap absensi, leger nilai, atau data santri, saya ingin dapat membaca data tabel dengan nyaman, sehingga saya tidak perlu memperbesar layar atau kehilangan konteks kolom.

#### Acceptance Criteria

1. WHILE Aplikasi ditampilkan pada Viewport_Mobile, THE Komponen_Tabel_Lebar SHALL dapat digulir secara horizontal di dalam wadahnya tanpa menyebabkan seluruh halaman bergulir horizontal.
2. WHILE Komponen_Tabel_Lebar digulir horizontal pada Viewport_Mobile, THE Sistem_Tampilan SHALL menjaga kolom pengenal baris (mis. nama santri) tetap terlihat.
3. THE Sistem_Tampilan SHALL menyajikan data rekap absensi siswa pada Viewport_Mobile dalam bentuk kartu per santri agar terbaca tanpa gulir horizontal.
4. WHEN Komponen_Tabel_Lebar dapat digulir horizontal namun sebagian kolom berada di luar layar pada Viewport_Mobile, THE Sistem_Tampilan SHALL menampilkan indikator visual bahwa terdapat konten yang dapat digulir.
5. THE Sistem_Tampilan SHALL menjaga ukuran teks di dalam Komponen_Tabel_Lebar pada Viewport_Mobile minimal 12px agar tetap terbaca.

### Requirement 6: Ukuran Target Sentuh

**User Story:** Sebagai pengguna HP, saya ingin tombol dan tautan cukup besar untuk disentuh, sehingga saya tidak salah tekan.

#### Acceptance Criteria

1. WHILE Aplikasi ditampilkan pada Viewport_Mobile, THE Target_Sentuh SHALL memiliki area sentuh minimal 44px kali 44px.
2. WHILE Aplikasi ditampilkan pada Viewport_Mobile, THE Sistem_Tampilan SHALL memberi jarak antar Target_Sentuh yang berdekatan minimal 8px.
3. WHERE sebuah ikon berfungsi sebagai Target_Sentuh tanpa label teks, THE Sistem_Tampilan SHALL menyediakan atribut `aria-label` yang mendeskripsikan aksinya.

### Requirement 7: Form dan Filter Responsif

**User Story:** Sebagai pengguna HP yang mengisi atau menyaring data, saya ingin form dan filter tertata rapi secara vertikal, sehingga mudah diisi tanpa terpotong.

#### Acceptance Criteria

1. WHILE Aplikasi ditampilkan pada Viewport_Mobile, THE Komponen_Form SHALL menata elemen input, select, dan tombol dalam satu kolom vertikal.
2. WHILE Aplikasi ditampilkan pada Viewport_Mobile, THE Komponen_Form SHALL membuat setiap elemen input, select, dan tombol utama memenuhi lebar penuh wadahnya.
3. WHEN sebuah elemen input pada Viewport_Mobile menerima fokus, THE Sistem_Tampilan SHALL menjaga elemen tersebut tetap terlihat di atas papan ketik virtual.
4. THE Sistem_Tampilan SHALL menetapkan tipe input yang sesuai (mis. `type="date"` untuk tanggal) agar perangkat menampilkan kontrol masukan yang tepat.

### Requirement 8: Modal Responsif

**User Story:** Sebagai pengguna HP, saya ingin dialog seperti pencarian atau tambah data tampil pas di layar, sehingga saya dapat menggunakannya tanpa konten terpotong.

#### Acceptance Criteria

1. WHILE Aplikasi ditampilkan pada Viewport_Mobile, THE Komponen_Modal SHALL menyesuaikan lebar dan tinggi terhadap ukuran Viewport_Mobile tanpa keluar dari batas layar.
2. WHILE isi Komponen_Modal melebihi tinggi Viewport_Mobile, THE Komponen_Modal SHALL menyediakan gulir vertikal pada area isinya.
3. THE Komponen_Modal SHALL menyediakan Target_Sentuh untuk menutup dialog yang memenuhi ketentuan ukuran pada Requirement 6.
4. WHILE Komponen_Modal terbuka pada Viewport_Mobile, THE Sistem_Tampilan SHALL mencegah konten latar di belakang modal bergulir.

### Requirement 9: Header dan Hero Responsif

**User Story:** Sebagai pengguna HP, saya ingin bagian header/hero halaman menyesuaikan ukuran layar, sehingga informasi utama tetap terbaca dan proporsional.

#### Acceptance Criteria

1. WHILE Aplikasi ditampilkan pada Viewport_Mobile, THE Header_Hero SHALL menata elemennya secara vertikal (kolom tunggal).
2. WHILE Aplikasi ditampilkan pada Viewport_Mobile, THE Header_Hero SHALL menggunakan ukuran teks judul yang lebih kecil dibanding pada Viewport_Desktop sesuai skala Breakpoint Tailwind.
3. THE Header_Hero SHALL menjaga seluruh teksnya tetap berada di dalam batas lebar Viewport_Mobile tanpa terpotong atau meluap.

### Requirement 10: Konsistensi Breakpoint

**User Story:** Sebagai pengembang yang memelihara aplikasi, saya ingin seluruh halaman memakai breakpoint yang sama, sehingga perilaku responsif dapat diprediksi dan mudah dirawat.

#### Acceptance Criteria

1. THE Sistem_Tampilan SHALL menggunakan Breakpoint bawaan Tailwind (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px) untuk seluruh aturan responsif.
2. THE Sistem_Tampilan SHALL menggunakan Breakpoint `md` (768px) sebagai batas peralihan antara Viewport_Mobile dan Viewport_Desktop di seluruh halaman.
3. THE Sistem_Tampilan SHALL menghindari penggunaan nilai breakpoint kustom di luar Breakpoint bawaan Tailwind untuk aturan tata letak responsif.

### Requirement 11: Halaman Prioritas Mobile

**User Story:** Sebagai pengguna yang paling sering membuka dashboard, absensi, rapot, rekap, dan profil santri lewat HP, saya ingin halaman-halaman tersebut dioptimalkan untuk mobile, sehingga tugas harian saya lancar di HP.

#### Acceptance Criteria

1. THE Sistem_Tampilan SHALL menerapkan Requirement 1 sampai Requirement 10 pada halaman `index.html`, `absensi.html`, `rapot.html`, `rekap.html`, dan `profil-santri.html`.
2. WHILE `rekap.html` ditampilkan pada Viewport_Mobile, THE Sistem_Tampilan SHALL menyediakan Drawer_Sidebar dan Bottom_Nav sesuai Requirement 1.
3. WHILE halaman prioritas menampilkan tab atau filter pada Viewport_Mobile, THE Sistem_Tampilan SHALL menjaga kontrol tab dan filter tetap dapat diakses dan dapat digulir tanpa meluap keluar layar.

### Requirement 12: Kemampuan Perbesaran (Zoom) untuk Aksesibilitas

**User Story:** Sebagai pengguna dengan keterbatasan penglihatan, saya ingin dapat memperbesar tampilan halaman di HP, sehingga saya dapat membaca konten yang kecil.

#### Acceptance Criteria

1. THE Sistem_Tampilan SHALL mengatur meta viewport agar pengguna dapat memperbesar (zoom) halaman pada perangkat seluler.
2. THE Sistem_Tampilan SHALL menetapkan `initial-scale=1.0` pada meta viewport di seluruh halaman.
3. THE Sistem_Tampilan SHALL menjaga fungsi zoom perangkat tetap aktif dengan tidak menetapkan `user-scalable=no` pada meta viewport.
