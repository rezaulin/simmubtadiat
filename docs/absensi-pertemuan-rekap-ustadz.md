# Desain: Absensi Per-Pertemuan & Rekap Kehadiran Ustadz

Catatan desain (bukan spec formal). Acuan implementasi langsung.

## Ringkasan
1. **Absensi siswa** berpindah dari model "1 baris per hari" menjadi **per pertemuan**
   (setiap bagian pasti **2 pertemuan/hari**). Tiap pertemuan = **½ hari**.
2. **Rekap siswa** (bulanan/rentang) mengakumulasi pertemuan per kategori lalu
   dikonversi ke **hari**: `hari = ceil(pertemuan / 2)`.
3. **Rekap ustadz** dihitung **per slot jadwal** (bulat, tanpa ½): Hadir vs Ghoib,
   dibandingkan jumlah slot jadwal pada rentang tanggal.
4. **Nilai Khos & Al-Bayan** memakai angka **hari hasil pembulatan**; **Izin** dihitung
   **tanpa Sakit**.

## Aturan hitung (dikunci)
- 1 pertemuan = 0,5 hari. Akumulasi per kategori, lalu **ceil** ke hari.
  - `PertemuanKeHari(n) = ceil(n/2) = (n+1)/2` (integer). Contoh: 41→21, 19→10.
- **Pilihan X**: Hadir siswa = (jumlah pertemuan yang benar-benar diisi / ada sesi)
  − izin − sakit − alpha.
- **Status** eksplisit: `izin` (bi idzni), `sakit`, `alpha` (bi ghoiri idzni). Hadir
  tidak disimpan (diturunkan dari sesi − non-hadir).
- **Sakit** tetap dicatat, tapi TIDAK masuk raport, Nilai Khos, maupun Al-Bayan.

## Koreksi nilai (dua sumbu, keduanya pakai HARI)
- **Nilai Khos (per semester, hanya mapel `akhlaq_perilaku`)**
  - Izin ≥ **20 hari**/semester → −1
  - Alpha ≥ **6 hari**/semester → −1 (independen, maks −2)
  - Rounding: jumlahkan pertemuan **se-semester (2 kuartal)** lalu ceil sekali.
- **Nilai Prestasi / Al-Bayan (per tahun = 2 semester)**
  - Izin ≥ **15 hari**/tahun → −1
  - Alpha ≥ **5 hari**/tahun → −1 (independen, maks −2)
  - Rounding: jumlahkan pertemuan **se-tahun** lalu ceil sekali.
  - **Bugfix**: query Al-Bayan lama menjumlah `rekap_absensi` tanpa filter tahun
    ajaran → diperbaiki agar difilter per `tahun_ajaran`.

## Model data
### Tabel baru `absensi_sesi` (sesi/pertemuan + bukti kehadiran ustadz)
`(id, bagian_id, jadwal_id?, mapel_id?, pengajar_id?, tanggal, pertemuan[1|2], created_at, updated_at)`,
`UNIQUE(bagian_id, tanggal, pertemuan)`. Menjadi:
- **denominator** Hadir siswa (jumlah sesi yang diisi untuk bagian), dan
- **bukti "ustadz masuk"** slot (via `jadwal_id`).

### `absensi_perizinan` (restrukturisasi — belum ada data lama)
Tambah `sesi_id` (FK ke absensi_sesi, ON DELETE CASCADE) + `status ('izin'|'sakit'|'alpha')`,
kunci unik `(santri_id, sesi_id)`. Hanya menyimpan baris NON-hadir. `tanggal`, `pengajar_id`,
`keterangan` dipertahankan. Kolom lama `is_alpha` diganti `status`.

### `rekap_absensi` (satuan PERTEMUAN mentah per kuartal)
Kolom `total_izin`, `total_alpha` kini berarti **pertemuan**; tambah `total_sakit`.
Konversi ke hari dilakukan saat baca (khos/bayan/raport/rekap).

## Alur input (per slot)
Ustadz memilih **slot jadwal** (mapel/jam) untuk bagian + tanggal, isi kehadiran santri,
Simpan. Saat simpan: upsert 1 `absensi_sesi` untuk `(bagian, tanggal, pertemuan)` (bukti
ustadz masuk), lalu tulis baris `absensi_perizinan` non-hadir yang tertaut ke sesi itu.
Submit **selalu** mencatat sesi walau semua santri hadir. "Jadwal Hari Ini" (chip) jadi
pintu utama karena sudah berbasis slot.

## Rekap Ustadz (per slot jadwal)
Input: rentang tanggal (+ filter pengajar opsional). Untuk tiap slot jadwal milik ustadz:
- **Seharusnya** = jumlah tanggal dalam rentang yang harinya (`hari`) cocok slot.
- **Hadir** = occurrence yang punya `absensi_sesi` cocok `(jadwal_id, tanggal)`.
- **Ghoib** = Seharusnya − Hadir. Ditampilkan apa adanya (bulat).

## Berkas terdampak
- DB: migrasi baru `022_absensi_pertemuan.sql`.
- `models/absensi.go` (input + recalc), helper `PertemuanKeHari`.
- `models/penilaian_dasar.go` (Khos), `models/penilaian_final.go` (Al-Bayan + bugfix tahun).
- `models/rekap.go` (rekap siswa → hari; rekap ustadz per-slot baru).
- `models/laporan.go`, `models/riwayat_akademik.go` (raport: izin+alpha hari, tanpa sakit).
- `handlers/absensi.go`, `handlers/rekap.go` (+ endpoint rekap ustadz).
- Frontend `absensi.html`/`absensi.js` (input per-slot), `rekap.html`/`rekap.js` (tampilan).

## Testing inti
- Unit/property: `PertemuanKeHari` (ceil), konversi rekap→hari, ambang khos/bayan.
- Go: kalkulasi Khos & Al-Bayan dengan data pertemuan (termasuk sakit tidak dihitung).
- Interaction ringan untuk input per-slot bila memungkinkan.
