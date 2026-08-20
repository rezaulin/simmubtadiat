# Implementation Plan: Mobile Responsive UI

## Overview

Rencana ini mengubah desain standardisasi tampilan mobile Mubtadiaat menjadi langkah-langkah pengkodean bertahap. Pendekatannya: (1) siapkan fondasi CSS utility dan token, (2) jadikan `xss.js` satu-satunya sumber perilaku navigasi dan RBAC (logika murni yang dapat diuji properti), (3) tetapkan markup navigasi kanonik dan terapkan ke halaman prioritas lalu halaman lain, (4) perbaiki tabel/form/modal/hero responsif, dan (5) rapikan meta viewport, breakpoint, serta hapus handler lama yang konflik di `main.js`. Setiap langkah menyatu ke langkah sebelumnya sehingga tidak ada kode menggantung.

Stack: HTML statis multi-page + Tailwind CSS v4 + JavaScript vanilla (Vite). Pengujian: Vitest + jsdom, dan fast-check untuk property-based testing pada lapisan logika murni.

## Tasks

- [x] 1. Siapkan fondasi CSS utility dan pengujian
  - Tambahkan utility `pb-safe` (`padding-bottom: env(safe-area-inset-bottom)`), `tap-target` (min 44×44px pada mobile), `scroll-shadow`/indikator gulir, dan pastikan guard `role-ready` terdefinisi di `frontend/src/style.css` (Tailwind v4 `@theme`/utilities)
  - Verifikasi token tema dan utility kustom yang sudah ada (`glass`, `glass-input`, `text-gradient`) tetap konsisten
  - Siapkan kerangka pengujian: konfigurasi Vitest dengan lingkungan jsdom dan tambahkan dependensi `fast-check` di `frontend/package.json`
  - _Requirements: 3.5, 6.1, 5.4, 4.4_

- [x] 2. Bangun modul logika navigasi & RBAC di `xss.js` (sumber kebenaran tunggal)
  - [x] 2.1 Definisikan `MENU_ACCESS` kanonik dan `computeAllowedLinks(role)`
    - Tetapkan peta `MENU_ACCESS` untuk semua Peran (`pimpinan`, `admin`, `mufatish`, `mustahiq`, `munawwib`, `wali_santri`) sesuai nilai kanonik pada desain di `frontend/src/js/xss.js`
    - Implementasikan fungsi murni `computeAllowedLinks(role)` yang mengembalikan array kosong untuk peran tak dikenal/kosong (`MENU_ACCESS[role] || []`)
    - _Requirements: 4.1, 4.2_

  - [x] 2.2 Tulis property test untuk penyaringan menu berbasis peran
    - **Property 1: Tautan navigasi yang terlihat sama dengan irisan tautan yang tersedia dan yang diizinkan peran**
    - **Validates: Requirements 4.1, 4.2**
    - Gunakan fast-check (≥100 iterasi); generator Peran valid + string acak, dan subset acak himpunan tautan halaman; muat markup nav kanonik di jsdom lalu jalankan `applyRoleUI` dan bandingkan himpunan tautan terlihat dengan irisan(tersedia, allowed(role))

  - [x] 2.3 Implementasikan efek DOM `applyRoleUI(role)`
    - Sembunyikan tautan `aside nav a` dan `nav.md\:hidden a` yang `href`-nya tidak ada dalam `computeAllowedLinks(role)`, lalu tambahkan kelas `role-ready` untuk menampilkan nav
    - Panggil `applyRoleUI` saat `DOMContentLoaded` dengan fallback `localStorage.user_role` untuk mencegah flash
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 2.4 Implementasikan `resolveActiveNav(pathname, items)` dan `markActiveNav()`
    - `resolveActiveNav` mengembalikan tepat satu item yang `href`-nya cocok dengan `pathname`, atau `null` bila tidak ada
    - `markActiveNav` menerapkan kelas aktif pada `a[data-nav]` yang cocok dan kelas non-aktif pada lainnya
    - _Requirements: 3.3_

  - [x] 2.5 Tulis property test untuk penentuan tautan aktif
    - **Property 3: Penentuan tautan aktif benar dan tunggal**
    - **Validates: Requirements 3.3**
    - Gunakan fast-check (≥100 iterasi); pilih `pathname` acak dari href item nav dan dari path yang tidak cocok; assert tepat satu tautan aktif saat cocok dan nol saat tidak cocok

- [x] 3. Implementasikan perilaku drawer & bottom nav global di `xss.js`
  - [x] 3.1 Implementasikan `openSidebar()`/`closeSidebar()` dan pemasangan event
    - Toggle `-translate-x-full` pada `#app-sidebar`, tampilkan/sembunyikan `#sidebar-backdrop`, dan kunci scroll body (`overflow-hidden md:overflow-auto`)
    - Pasang handler untuk `#btn-open-sidebar`, `#btn-close-sidebar`, klik backdrop, tombol Escape, dan tap tautan di dalam drawer (menutup pada mobile); guard `if (!sidebar) return;`
    - Reset drawer & backdrop saat resize melewati 768px; sambungkan `#theme-toggle-mobile`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.2 Tulis unit/interaction test perilaku drawer
    - Uji open/close via hamburger, tombol tutup, backdrop, Escape, tap link, scroll-lock body, dan reset saat resize di jsdom
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.3 Hapus handler sidebar lama yang konflik dari `main.js`
    - Buang seleksi `aside` generik + `#sidebar-overlay` berbasis `hidden` di `frontend/src/js/main.js`; pertahankan pengalihan `/login.html` saat `/api/me` gagal dan integrasi `openSearchModal()` untuk FAB
    - _Requirements: 1.4, 2.1, 3.2_

- [x] 4. Checkpoint - Pastikan semua tes lolos
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Tetapkan markup navigasi kanonik pada halaman acuan (`index.html`)
  - Pastikan `index.html` memuat blok kanonik: `aside#app-sidebar` (drawer transform `-translate-x-full md:translate-x-0`), `#btn-close-sidebar`, `#sidebar-backdrop`, Top_Bar_Mobile (`#btn-open-sidebar`, `#theme-toggle-mobile`), dan Bottom_Nav dengan FAB `#btn-mobile-search`, memakai ikon Lucide
  - Sinkronkan head-guard `menuAccess` `index.html` agar identik dengan `MENU_ACCESS` kanonik; beri `main` kelas `pb-24 md:pb-8` dan `pb-safe` pada Bottom_Nav
  - Ekstrak blok markup ini sebagai referensi kanonik untuk halaman lain
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.4, 3.5, 4.3_

- [x] 6. Terapkan markup navigasi kanonik ke halaman prioritas lainnya
  - [x] 6.1 Perbaiki navigasi `rekap.html`
    - Ganti `aside` `hidden md:flex` menjadi `aside#app-sidebar` drawer transform kanonik; tambahkan `#btn-close-sidebar`, `#sidebar-backdrop`, Top_Bar_Mobile, dan Bottom_Nav; ganti SVG inline menjadi ikon Lucide dan beri `id`/`aria-label` pada tombol tema
    - Selaraskan head-guard `menuAccess` (termasuk `wali_santri`) agar identik dengan peta kanonik
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.3, 11.2_

  - [x] 6.2 Terapkan markup navigasi kanonik ke `absensi.html`, `rapot.html`, dan `profil-santri.html`
    - Sisipkan/normalkan blok navigasi kanonik identik dan head-guard `menuAccess` yang sama; beri `pb-24 md:pb-8` pada konten utama
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.3, 11.1_

  - [x] 6.3 Tulis structural test navigasi halaman prioritas
    - Assert keberadaan `aside#app-sidebar`, `#btn-close-sidebar`, `#sidebar-backdrop`, `#btn-open-sidebar`, dan Bottom_Nav; assert blok nav ter-normalisasi identik dengan acuan `index.html`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.1, 11.2_

  - [x] 6.4 Tulis property test konsistensi peta izin menu antar halaman
    - **Property 2: Peta izin menu konsisten antar halaman**
    - **Validates: Requirements 4.3**
    - Gunakan fast-check; parse `menuAccess` yang tertanam pada tiap file halaman dan bandingkan set-equal dengan `MENU_ACCESS` kanonik untuk tiap Peran

- [x] 7. Terapkan markup navigasi kanonik ke halaman tercakup lainnya
  - Normalkan blok navigasi kanonik dan head-guard `menuAccess` pada `santri.html`, `perpindahan.html`, `kelas.html`, `penilaian.html`, `pengajar.html`, `dewan-harian.html`, `arsip.html`, `alumni.html`, `laporan.html`, `settings.html` (kecualikan `login.html` dan `change-password.html`)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.3_

- [x] 8. Checkpoint - Pastikan semua tes lolos
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implementasikan keterbacaan tabel lebar
  - [x] 9.1 Terapkan wadah gulir horizontal, kolom lengket, indikator gulir, dan ukuran teks pada tabel leger/data
    - Bungkus tabel lebar dengan `overflow-x-auto` (`min-w-max`), buat kolom pengenal baris `sticky left-0` dengan latar solid, tampilkan indikator gulir saat `scrollWidth > clientWidth`, dan pastikan teks minimal `text-xs` (12px) pada halaman prioritas (mis. `rekap.html`, `rapot.html`)
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 9.2 Render rekap absensi siswa sebagai kartu per santri pada mobile
    - Tambahkan tampilan kartu (`#rekap-siswa-view`) untuk Viewport_Mobile di `frontend/src/js/rekap.js` sambil mempertahankan tabel penuh pada Viewport_Desktop
    - _Requirements: 5.3_

  - [x] 9.3 Tulis visual/interaction test tabel lebar
    - Snapshot lebar mobile: wadah `overflow-x-auto`, kolom `sticky left-0`, indikator gulir muncul saat overflow, teks ≥12px, dan kartu per-santri untuk rekap absensi
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 10. Implementasikan form, modal, dan hero responsif
  - [x] 10.1 Terapkan tata letak form/filter responsif
    - Terapkan `flex flex-col sm:flex-row`, kontrol `w-full sm:w-48`, `scroll-margin` + `scrollIntoView({ block: 'center' })` pada `focus`, dan tipe input semantik; bungkus baris tab/filter dengan `overflow-x-auto` pada halaman prioritas
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 11.3_

  - [x] 10.2 Terapkan modal responsif
    - Terapkan kontainer `w-full max-w-2xl`, padding `p-4 sm:p-6 md:p-12`, tinggi `h-[80vh] md:h-[600px]` dengan isi `overflow-y-auto`, tombol tutup memenuhi Target_Sentuh, dan scroll-lock body saat modal terbuka (mis. `#search-modal`)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 10.3 Terapkan Header_Hero responsif
    - Terapkan `flex flex-col md:flex-row`, skala teks `text-3xl md:text-4xl`, padding wadah `px-4 md:px-8`, dan `break-words` agar teks tidak meluap
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 10.4 Tulis visual/interaction test form, modal, dan hero
    - Snapshot mobile untuk kolom tunggal & kontrol `w-full`, skala teks hero, dan baris tab/filter yang dapat digulir; uji modal (batas dalam viewport, isi `overflow-y-auto`, scroll-lock)
    - _Requirements: 7.1, 7.2, 8.1, 8.2, 8.4, 9.1, 9.2, 9.3, 11.3_

- [x] 11. Seragamkan meta viewport, breakpoint, dan target sentuh
  - [x] 11.1 Standarkan meta viewport dan target sentuh di seluruh halaman tercakup
    - Ubah meta viewport menjadi `width=device-width, initial-scale=1.0, viewport-fit=cover` (hapus `maximum-scale`/`user-scalable=no`); terapkan `.tap-target` dan `gap-2` pada tombol/ikon interaktif dan pastikan setiap ikon-only memiliki `aria-label`
    - _Requirements: 6.1, 6.2, 6.3, 12.1, 12.2, 12.3_

  - [x] 11.2 Selaraskan breakpoint responsif
    - Pastikan seluruh aturan responsif memakai prefiks Tailwind bawaan (`sm|md|lg|xl`) dengan `md` sebagai batas mobile/desktop; hapus breakpoint kustom untuk tata letak
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 11.3 Tulis static markup scan test (lint-style)
    - Assert meta viewport tiap halaman memuat `initial-scale=1.0`, tanpa `user-scalable=no`, tanpa `maximum-scale`; pindai kelas responsif memakai hanya `sm|md|lg|xl` dan peralihan `md:` konsisten; assert setiap tombol/tautan ikon-only punya `aria-label` tak kosong
    - _Requirements: 6.3, 10.1, 10.2, 10.3, 12.1, 12.2, 12.3_

  - [x] 11.4 Tulis test pengukuran target sentuh
    - Ukur `boundingBox` memastikan ≥44×44px dan jarak ≥8px antar target berdekatan pada Viewport_Mobile
    - _Requirements: 6.1, 6.2_

- [x] 12. Checkpoint akhir - Pastikan semua tes lolos
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks bertanda `*` bersifat opsional (pengujian) dan dapat dilewati untuk MVP lebih cepat.
- Setiap task merujuk klausa requirement spesifik untuk keterlacakan.
- Checkpoint memastikan validasi bertahap.
- Property test memvalidasi properti kebenaran universal (RBAC filtering, konsistensi peta menu, active-nav); unit/structural/visual test menangani struktur DOM dan tata letak responsif.
- `xss.js` adalah satu-satunya sumber perilaku navigasi & RBAC; markup navigasi diduplikasi antar halaman namun WAJIB identik dengan acuan `index.html`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.4"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.5", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "5"] },
    { "id": 4, "tasks": ["6.1", "6.2", "7"] },
    { "id": 5, "tasks": ["6.3", "6.4", "9.1", "9.2", "10.1", "10.2", "10.3"] },
    { "id": 6, "tasks": ["9.3", "10.4", "11.1", "11.2"] },
    { "id": 7, "tasks": ["11.3", "11.4"] }
  ]
}
```
