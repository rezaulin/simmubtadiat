# Implementation Plan: Dashboard Redesign & Kalender

## Overview

Rencana ini mengubah desain menjadi langkah-langkah kode inkremental untuk membangun ulang Dashboard (`frontend/index.html` + `frontend/src/js/main.js`) menjadi sadar-peran, menerapkan tema "Teal Tenang" terpusat pada `frontend/style.css`, serta menambahkan widget Jadwal Hari Ini (dengan deep-link ke `frontend/src/js/absensi.js`) dan Kalender & Agenda.

Pendekatan: bangun token tema lebih dulu, lalu ekstrak seluruh logika inti sebagai fungsi murni yang diekspor dari `main.js`/`absensi.js` (agar dapat diuji berbasis properti), kemudian markup, lapisan render, lapisan orkestrasi (fetch + status), dan terakhir wiring role-aware + deep-link. Bahasa implementasi: JavaScript (vanilla, ESM), pengujian dengan Vitest + fast-check + jsdom (konsisten dengan `frontend/tests/*.property.test.js`).

Setiap test properti ditandai dengan komentar: `Feature: dashboard-redesign-kalender, Property {number}: {property_text}` dan dijalankan minimum 100 iterasi (`{ numRuns: 100 }`).

## Tasks

- [x] 1. Terapkan tema "Teal Tenang" terpusat
  - [x] 1.1 Perbarui token `@theme` dan utilitas kartu/hero di `frontend/style.css`
    - Set `--color-primary: #0E7C86`, `--color-primary-hover: #0F6870`
    - Tambah token hero gradient `--color-hero-from: #0F6E77`, `--color-hero-to: #12A2A8` dan utility `.hero-gradient`
    - Set `--color-light-bg: #F5F7F5`, `--color-accent-gold: #E0A93B`
    - Beri utility kartu terpusat `border-width: 1px`
    - Pertahankan token Mode_Gelap; gunakan `var(--token, fallback)` untuk degradasi anggun
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

  - [x]* 1.2 Tulis unit test nilai token & border kartu
    - Verifikasi nilai `@theme` (1.1–1.3) dan border kartu 1px (1.4), serta fallback token (1.7)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

  - [x] 1.3 Rujuk Token_Warna dari `@theme` di seluruh berkas HTML `frontend/`
    - Ganti gradient/warna biru hardcoded (mis. `from-indigo-600`, `#2B5BDB`) menjadi rujukan token/utility
    - Pastikan warna primary, hover, hero gradient, background, dan aksen bersumber dari token
    - _Requirements: 1.5_

  - [x]* 1.4 Tulis property test tidak ada warna primer/hero hardcoded di HTML
    - **Property 1: Tidak ada warna primer/hero yang di-hardcode di HTML**
    - **Validates: Requirements 1.5**

  - [x]* 1.5 Tulis property test kontras Mode_Gelap memenuhi ambang WCAG
    - **Property 2: Kontras Mode_Gelap memenuhi ambang WCAG**
    - **Validates: Requirements 1.6**

- [x] 2. Implementasi fungsi murni resolusi peran & normalisasi metrik (`main.js`)
  - [x] 2.1 Implementasi `resolveDashboardView(role)` dan `toDisplayCount(value)`
    - `resolveDashboardView` → `'admin'` untuk pimpinan/admin/mufatish, `'guru'` untuk mustahiq/munawwib, `'unknown'` selain itu
    - `toDisplayCount` → bilangan bulat non-negatif; non-number/negatif/NaN/null/undefined → 0
    - Ekspor kedua fungsi dari `main.js`
    - _Requirements: 4.1, 4.2, 4.5, 7.6, 2.5, 2.6, 7.1, 7.4, 7.5_

  - [x]* 2.2 Tulis property test pemetaan peran ke himpunan widget
    - **Property 10: Pemetaan peran ke himpunan widget**
    - **Validates: Requirements 4.1, 4.2, 4.5, 7.6**

  - [x]* 2.3 Tulis property test normalisasi metrik menjadi bilangan bulat non-negatif
    - **Property 5: Normalisasi metrik menjadi bilangan bulat non-negatif**
    - **Validates: Requirements 2.5, 2.6, 7.1, 7.4, 7.5**

- [x] 3. Implementasi fungsi murni statistik & grafik (`main.js`)
  - [x] 3.1 Implementasi `groupByTingkatan`, `groupByStatus`, dan `computeDonutSegments`
    - `groupByTingkatan`/`groupByStatus`: kelompok per field; kosong/null → "Tidak Diketahui"; setiap santri terhitung sekali
    - `computeDonutSegments`: hitung `fraction`/`startAngle`/`endAngle` proporsional; total 0 → `[]`
    - Ekspor ketiga fungsi dari `main.js`
    - _Requirements: 7.2, 7.3, 7.8, 2.10, 2.11_

  - [x]* 3.2 Tulis property test distribusi tingkatan mengonservasi total
    - **Property 6: Distribusi tingkatan mengonservasi total santri**
    - **Validates: Requirements 7.2, 7.8**

  - [x]* 3.3 Tulis property test komposisi status adalah partisi santri
    - **Property 7: Komposisi status adalah partisi santri**
    - **Validates: Requirements 7.3, 7.8**

  - [x]* 3.4 Tulis property test segmen donut proporsional & kosong saat total nol
    - **Property 8: Segmen donut proporsional dan kosong saat total nol**
    - **Validates: Requirements 2.10, 2.11**

- [x] 4. Implementasi fungsi murni kalender, jadwal & deep-link
  - [x] 4.1 Implementasi `toISODateLocal`, `buildWeekStrip`, `buildAgendaIndex`, `sortJadwal`, `buildAbsensiDeepLink` di `main.js`
    - `buildWeekStrip(today)` → 7 tanggal berurutan memuat hari ini (tepat satu `isToday`)
    - `buildAgendaIndex(kuartalList, jadwalHariIni, today)` → `Map<YYYY-MM-DD, Agenda[]>` bertipe kuartal-mulai/kuartal-selesai/jadwal
    - `sortJadwal` → urut menaik `jam_mulai`, permutasi masukan
    - `buildAbsensiDeepLink(bagianId, today)` → `absensi.html?bagian=<id>&tanggal=<YYYY-MM-DD>`
    - Ekspor seluruh fungsi dari `main.js`
    - _Requirements: 6.3, 6.1, 6.4, 6.5, 5.3, 5.5_

  - [x] 4.2 Implementasi `parseAbsensiQuery(search)` di `absensi.js`
    - Valid bila `bagian` ada & numerik dan `tanggal` cocok `^\d{4}-\d{2}-\d{2}$` serta tanggal kalender valid
    - Return `{ valid, bagian, tanggal }`; ekspor dari `absensi.js`
    - _Requirements: 5.5, 5.7_

  - [x]* 4.3 Tulis property test strip minggu tujuh hari berurutan memuat hari ini
    - **Property 14: Strip minggu tujuh hari berurutan memuat hari ini**
    - **Validates: Requirements 6.3**

  - [x]* 4.4 Tulis property test pengurutan jadwal menaik & mempertahankan entri
    - **Property 11: Pengurutan jadwal menaik dan mempertahankan entri**
    - **Validates: Requirements 5.3**

  - [x]* 4.5 Tulis property test penanda & daftar agenda setara keberadaan agenda
    - **Property 15: Penanda dan daftar agenda setara dengan keberadaan agenda**
    - **Validates: Requirements 6.1, 6.4, 6.5**

  - [x]* 4.6 Tulis property test deep-link round-trip & validasi query
    - **Property 13: Deep-link absensi round-trip dan validasi query**
    - **Validates: Requirements 5.5, 5.7**

- [x] 5. Checkpoint - Pastikan seluruh test lolos
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Bangun struktur markup Dashboard (`frontend/index.html`)
  - [x] 6.1 Tambah anchor konten, hero, ringkasan mobile, dan Bottom_Nav
    - Tambah `#dash-hero`, `#dash-role-region`, `#dash-metrics`, `#dash-charts`, `#dash-side`, `#dash-jadwal`, `#dash-mobile-summary`
    - Hero memuat `#user-greeting`, `#user-role-badge`, `#hero-date`, `#hero-time`, `#hero-hijri`; sudut membulat ≥16px untuk ponsel
    - Replikasi blok Bottom_Nav + FAB verbatim dari blok kanonik; pertahankan `pb-24 md:pb-8` pada `main`
    - _Requirements: 2.1, 2.7, 2.8, 3.1, 3.5, 3.6_

  - [x]* 6.2 Tulis unit/DOM test struktur & tata letak markup
    - Verifikasi urutan kolom desktop (2.7, 2.8), satu kolom + radius hero ponsel (3.1), padding bawah ≥ Bottom_Nav (3.6), kesamaan Bottom_Nav dengan kanonik (3.5), tidak ada import pustaka chart (2.9)
    - _Requirements: 2.7, 2.8, 3.1, 3.5, 3.6, 2.9_

- [x] 7. Implementasi lapisan render widget (`main.js`)
  - [x] 7.1 Implementasi `renderHero`, `renderMetrics`, `renderMobileSummary`
    - `renderHero`: salam, nama ter-escape/placeholder, badge peran/placeholder, tanggal/waktu/hijriah; tak melempar error
    - `renderMetrics`: tepat empat kartu (garis aksen, badge, nilai numerik), termasuk kartu "Santri Pengabdian"
    - `renderMobileSummary`: tiga blok berurutan Santri → Khidmah → Alumni dengan label + nilai numerik
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 3.2_

  - [x]* 7.2 Tulis property test hero memuat elemen wajib dengan placeholder aman
    - **Property 3: Hero selalu memuat elemen wajib dengan placeholder aman**
    - **Validates: Requirements 2.1, 2.3**

  - [x]* 7.3 Tulis property test Widget_Statistik selalu tepat empat kartu lengkap
    - **Property 4: Widget_Statistik selalu tepat empat kartu lengkap**
    - **Validates: Requirements 2.4**

  - [x]* 7.4 Tulis property test kartu ringkasan ponsel berurutan & lengkap
    - **Property 9: Kartu ringkasan ponsel berurutan dan lengkap**
    - **Validates: Requirements 3.2**

  - [x] 7.5 Implementasi `renderTingkatanChart`, `renderStatusChart`, `renderRingkasanPengajar`, `renderJadwalCard`, `renderKalenderAgenda`
    - Grafik CSS murni (bar + donut via conic-gradient); empty state saat total 0
    - `renderJadwalCard`: memuat `jam_mulai`, `jam_selesai`, `nama_mapel`, `nama_bagian`, `tingkatan`, `kelas` (ter-escape)
    - `renderKalenderAgenda`: strip 7 hari (highlight hari ini), titik penanda hanya tanggal beragenda, baris hanya tanggal beragenda, pesan bila tak ada agenda
    - _Requirements: 2.7, 2.8, 2.10, 2.11, 5.4, 6.3, 6.4, 6.5, 6.6_

  - [x]* 7.6 Tulis property test Kartu_Jadwal memuat seluruh field wajib
    - **Property 12: Kartu_Jadwal memuat seluruh field wajib**
    - **Validates: Requirements 5.4**

- [x] 8. Implementasi lapisan orkestrasi jaringan & status (`main.js`)
  - [x] 8.1 Implementasi `fetchWithTimeout` dan seluruh fungsi `load*`
    - `fetchWithTimeout(url, ms)` berbasis `AbortController` (5 detik jadwal; 10 detik lainnya)
    - `loadStats`, `loadPengabdian`, `loadPengajar`, `loadSantriCharts`, `loadJadwalHariIni`, `loadKalenderAgenda` dengan status loading/empty/error + tombol "Muat ulang"
    - Isolasi kegagalan per widget dalam `try/catch`; tick waktu hero tiap 1 detik
    - _Requirements: 5.1, 5.2, 5.8, 5.9, 6.2, 7.1, 7.7, 2.2_

  - [x]* 8.2 Tulis interaction test (jsdom) untuk loading, isolasi kegagalan & degradasi
    - Verifikasi indikator loading (5.2), isolasi kegagalan widget (7.7), degradasi Kalender_Agenda saat gagal (6.2), pesan error + muat ulang jadwal (5.9)
    - _Requirements: 5.2, 5.9, 6.2, 7.7_

- [x] 9. Wiring role-aware & deep-link Absensi
  - [x] 9.1 Wire inisialisasi role-aware pada `main.js`
    - Ambil `/api/me`, panggil `resolveDashboardView`, render region sesuai peran (admin: statistik+grafik+kalender; guru: Jadwal_Hari_Ini teratas; unknown: pesan konten tak tersedia)
    - Empty state jadwal saat tak ada kelas berjadwal
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [x] 9.2 Wire `parseAbsensiQuery` ke `init()` `absensi.js`
    - Setelah `loadFilters()`, jika query valid set `filterTanggal.value` lalu panggil `selectBagian(bagian)` tanpa interaksi tambahan; jika tidak valid tampilkan pesan "bagian belum dipilih"
    - _Requirements: 5.6, 5.7_

  - [x]* 9.3 Tulis interaction test `selectBagian` dipanggil pada param valid
    - Verifikasi `selectBagian` terpanggil dengan `bagian` dan `tanggal` ter-set saat query valid (5.6); form keadaan awal saat invalid (5.7)
    - _Requirements: 5.6, 5.7_

  - [x]* 9.4 Tulis integration test RBAC jadwal
    - Verifikasi `GET /api/akademik/jadwal-saya-hari-ini` hanya mengembalikan jadwal milik pengajar yang login
    - _Requirements: 4.3_

- [x] 10. Checkpoint final - Pastikan seluruh test lolos
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks bertanda `*` bersifat opsional (test) dan dapat dilewati untuk MVP lebih cepat, namun tetap dianjurkan.
- Setiap task merujuk requirement spesifik untuk keterlacakan; setiap property test merujuk satu properti desain.
- Property test memakai Vitest + fast-check + jsdom, minimum 100 iterasi, ditandai `Feature: dashboard-redesign-kalender, Property {n}: ...`.
- Fungsi murni diekspor dari `main.js`/`absensi.js` agar dapat diimpor test tanpa efek samping.
- Checkpoint memastikan validasi inkremental sebelum melanjutkan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "4.2", "6.1"] },
    { "id": 1, "tasks": ["3.1", "1.3", "1.2", "2.2", "2.3"] },
    { "id": 2, "tasks": ["4.1", "3.2", "3.3", "3.4", "1.4", "1.5", "6.2"] },
    { "id": 3, "tasks": ["7.1", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 4, "tasks": ["7.5", "7.2", "7.3", "7.4"] },
    { "id": 5, "tasks": ["8.1", "7.6"] },
    { "id": 6, "tasks": ["9.1", "9.2", "8.2"] },
    { "id": 7, "tasks": ["9.3", "9.4"] }
  ]
}
```
