# Desain: Pengembangan Menu Penilaian → 4 Aspek

> Status: DRAF ANALISA (belum ada kode yang diubah)
> Tanggal: 2026-10-01
> Sumber spesifikasi: permintaan owner (chat).

## 1. Ringkasan

Menu **Penilaian** dipetakan jadi 4 aspek:

| # | Aspek | Status |
|---|-------|--------|
| 1 | **Nilai Akademik** | Menu LAMA — hanya ganti label, isi TIDAK disentuh |
| 2 | **Nilai Di Bawah Rata² (4,4)** | BARU — auto dari nilai akademik + input takziran manual |
| 3 | **Setoran Juz Amma** | BARU — checklist surat per kelas + evaluasi |
| 4 | **Nilai Kompetensi** | BARU — UBQ / Ujian Praktik / Baca Kitab (Lulus–Her–Tidak Lulus) |

Aspek 2–4 pindah ke halaman baru **`penilaian-tambahan.html`** (3 tab).
Menu lama tetap di `/penilaian.html` dengan label baru **"Penilaian Akademik"**.

**Prinsip:** pipeline lama (kuartal → khos → AM → bayan, kunci 3 lapis) **tidak
disentuh sama sekali**. Tidak ada kolom/tabel lama yang dimodifikasi.

## 2. Pemetaan menu & halaman

```
Sidebar
├── Penilaian Akademik   → /penilaian.html       (LAMA, label saja berubah)
└── Penilaian Tambahan   → /penilaian-tambahan.html (BARU)
    ├── Tab A: Di Bawah Rata²      (semua kelas)
    ├── Tab B: Setoran Juz Amma    (kecuali I'dadiyah)
    └── Tab C: Nilai Kompetensi    (khusus: 3 tsn, 1/2/3 aly)
```

- URL lama TIDAK berubah → link/shortcut lama tetap hidup.
- Nav disalin statis di tiap `frontend/*.html` (tidak ada partial), lalu
  ditampilkan/disembunyikan JS via `MENU_ACCESS` di `xss.js`.

## 3. Akses (RBAC)

| Aksi | Role |
|------|------|
| Input/edit nilai tambahan | **pimpinan** saja |
| Download/ekspor data | **pimpinan** saja (sementara) |
| Lihat (read-only) | pimpinan, mufatish, mustahiq, walisantri |

- **Walisantri**: hanya melihat data **anaknya sendiri** (via `wali_santri_link`),
  semua kontrol input disembunyikan.
- Backend wajib cek role di route (bukan cuma sembunyikan tombol):
  - `POST` → `RequireRoles("pimpinan")`
  - `GET` → `RequireRoles("pimpinan","mufatish","mustahiq")` + special-case
    `wali_santri` (filter `santri_id` anak) — atau endpoint terpisah untuk wali.
- **Keputusan**: mustahiq **dibatasi cakupan bagian** sama seperti menu
  akademik (pola `penilaianScopeGuard*` / `GetBagianPenilaian`).

## 4. Skema Database (3 tabel BARU)

```sql
-- A. Nilai Di Bawah Rata² + status takziran
CREATE TABLE penilaian_takziran (
  id              SERIAL PRIMARY KEY,
  santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  kuartal         INT NOT NULL CHECK (kuartal BETWEEN 1 AND 4),
  tahun_ajaran    VARCHAR(9) NOT NULL,
  konsekuensi     TEXT,                       -- input pimpinan
  jenis_takziran  TEXT,                       -- input pimpinan
  dalam_masa      BOOLEAN NOT NULL DEFAULT false,   -- "Dalam masa Takziran" ✔
  selesai         BOOLEAN NOT NULL DEFAULT false,   -- "Selesai Melaksanakan" ✔
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (santri_id, kuartal, tahun_ajaran)
);
-- Jumlah nilai & Rata2 TIDAK disimpan: selalu dihitung live dari nilai_kuartal.

-- B. Setoran Juz Amma
CREATE TABLE setoran_juz_amma (
  id              SERIAL PRIMARY KEY,
  santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  surat_no        INT NOT NULL CHECK (surat_no BETWEEN 78 AND 114), -- urut 114→bawah
  setor           BOOLEAN NOT NULL DEFAULT false,  -- ceklis nama surat
  evaluasi        TEXT,                            -- dropdown (opsi: lihat §6)
  status          VARCHAR(10) NOT NULL DEFAULT 'belum'
                    CHECK (status IN ('selesai','belum')), -- model memilih
  tahun_ajaran    VARCHAR(9) NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (santri_id, surat_no, tahun_ajaran)
);

-- C. Nilai Kompetensi
CREATE TABLE nilai_kompetensi (
  id              SERIAL PRIMARY KEY,
  santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  kategori        VARCHAR(10) NOT NULL CHECK (kategori IN ('ubq','praktik','kitab')),
  hasil           VARCHAR(12) CHECK (hasil IN ('lulus','her','tidak_lulus')),
  tahun_ajaran    VARCHAR(9) NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (santri_id, kategori, tahun_ajaran)
);
```

Migrasi: SQL file di `migrations/`, dijalankan manual via `psql` (lokal + VPS 1).

## 5. Logika per fitur

### Tab A — Nilai Di Bawah Rata² (4,4)

- **Otomatis**: rata-rata `nilai_kuartal` per santri per kuartal (TA aktif),
  semua mapel yang bernilai **KECUALI kategori akhlaq**
  (`kategori NOT IN ('akhlaq','akhlaq_perilaku')`). Skala data terbukti
  **0–10** (min 1, max 10).
- Kandidat muncul bila `AVG(nilai) < 4.4` pada kuartal terpilih.
- Baris **tetap tersimpan** walau takziran sudah selesai — kalau nanti
  rata²-nya naik di atas 4,4, baris lama tetap tampil (tidak dihapus otomatis).
- Kolom: Nomer · Nama · Bagian · Jumlah nilai (SUM) · Rata² Nilai (AVG) ·
  Konsekuensi · Jenis Takziran · Dalam masa Takziran (✔) · Selesai (✔)
- Filter: **Dalam masa takziran** (ya/tidak) & **Selesai takziran** (ya/tidak),
  plus selector kuartal + tahun ajaran.
- Isian manual (konsekuensi, jenis, 2 ceklis) disimpan via satu `POST`.

### Tab B — Setoran Juz Amma

- **Satu baris per siswi**, isi cell "Nama surat" = deret **ceklis** surat sesuai
  rentang kelasnya (urut dari an-Nas ke bawah), lalu dropdown **Evaluasi**
  (`Lulus / Her / Tidak Lulus`) dan model pilih **Selesai/Belum**.
- **I'dadiyah (1–3) TIDAK ikut** — tab hanya berisi ibt 4–6, tsn 1–3, aly 1–3.

| Kelas | Rentang surat (an-Nas → …) | Jumlah |
|-------|---------------------------|--------|
| 4 ibt | Al-Kautsar (108) | 7 |
| 5 ibt | al-Humazah (104) | 11 |
| 6 ibt | az-Zalzalah (99) | 16 |
| 1 tsn | al-Qadr (97) | 18 |
| 2 tsn | ad-Duha (93) | 22 |
| 3 tsn | al-A'la (87) | 28 |
| 1 aly | al-Muthoffifin (83) | 32 |
| 2 aly | 'Abasa (80) | 35 |
| 3 aly | an-Naba' (78) | 37 |

- Rentang disimpan sebagai konstanta backend (map kelas → `surat_no` target),
  kelas (map kelas → `surat_no` target), bukan hardcode di HTML. I'dadiyah
  tidak punya entri → siswanya otomatis tidak tampil.
- Filter: **Selesai / Belum Selesai** + **Evaluasi (Lulus/Her/Tidak Lulus)**.
- Banner keterangan: *"Lulus setoran Juz Amma menjadi syarat mengikuti ujian
  semester genap · Batas akhir: Kuartal 2"*.

### Tab C — Nilai Kompetensi

- 3 kategori dengan **filter**: `Ujian Baca Al-Qur'an (UBQ)` ·
  `Ujian Praktik` · `Ujian Baca Kitab`.
- Isi per siswi: **Lulus / Her / Tidak Lulus** (model pilih).
- Nama & bagian diambil dari sumber yang sama dengan fitur Nilai Akademik
  (daftar siswi per bagian).
- **Kelas yang berlaku** (baris hanya tampil di kelas ini):

| Kelas | Kategori ujian |
|-------|----------------|
| 3 tsn | UBQ + Baca Kitab + Praktik |
| 1 aly | Praktik |
| 2 aly | UBQ |
| 3 aly | Baca Kitab + Praktik |

- Filter lain: **hasil** (lulus / her / tidak lulus).
- Banner syarat ijazah:
  - **6 ibt & 3 tsn**: Lulus praktik + UBQ + baca kitab.
  - **3 aly**: Lulus praktik + UBQ + baca kitab **+ khidmah 1 tahun**.
- Catatan jadwal (ditampilkan sebagai keterangan, bukan aturan sistem):
  tajhiz al-mayit di 1 aly, UBQ di 2 aly, baca kitab di 3 aly; tsanawiyah
  ketiganya di 3 tsn.

## 6. API (baru, prefiks `/api/penilaian-tambahan`)

```
GET  /bawah-rata?kuartal=&tahun_ajaran=&dalam_masa=&selesai=   (auto-compute)
POST /bawah-rata/takziran        {santri_id, kuartal, konsekuensi, jenis, dalam_masa, selesai}
GET  /juz-amma?bagian_id=&status=&tahun_ajaran=
POST /juz-amma                   {santri_id, surat_no, setor, evaluasi, status}
GET  /kompetensi?kategori=&hasil=&bagian_id=&tahun_ajaran=
POST /kompetensi                 {santri_id, kategori, hasil}
GET  /export?fitur=bawah-rata|juz-amma|kompetensi&...          (pimpinan only)
GET  /wali/anak              (khusus wali_santri → read-only data anak)
```

- `GET` struktur sama dengan pola `/api/penilaian/bagian` + filter.
- `POST` balas `{status:"ok"}`; semua tulisan dibungkus role check pimpinan.
- Ekspor ikut pola `ExportSantri`/`ExportPengajar` (`GET .../export`).

## 7. Frontend

1. **Rename label** (ikuti recipe `frontend-nav-and-lockdown.md`):
   - `Penilaian` → `Penilaian Akademik` di nav **16 file** frontend
     (1×/file, termasuk 2 file preview CRLF) + `main.js` breadcrumb
     (baris ~1110, `PAGE_META['/penilaian.html'].label`) + judul di dalam
     `penilaian.html`.
   - **Jangan** ubah istilah "penilaian" di teks lain (kesehatan data, dll).
   - Hitung kemunculan dulu → patch per file → verify 0 → build → bukti di
     container (`docker exec grep`) → bukti live → commit.
2. **Halaman baru** `frontend/penilaian-tambahan.html` + `src/js/penilaian-tambahan.js`
   (di-bundle seperti halaman lain):
   - 3 tab, tabel masing-masing + toolbar filter sesuai §5.
   - Mode read-only otomatis kalau role bukan pimpinan (tombol simpan/unduh
     tidak dirender) — backend tetap mengunci.
   - Untuk **wali**: halaman yang sama, data dibatasi anak + kontrol disembunyikan.
3. **Nav**: tambah item `Penilaian Tambahan` (icon `award`/`clipboard-plus`)
   tepat setelah Penilaian Akademik di semua file nav; register path di
   `MENU_ACCESS` (pimpinan, mufatish, mustahiq, wali_santri) di `xss.js`.
4. **Wali home** (`index.html`): opsional — kartu/tautan ringkas ke halaman ini.

## 8. Fase Pengerjaan

| Fase | Isi | Output |
|------|-----|--------|
| 0 | Rename label → "Penilaian Akademik" | commit kecil, deploy, bukti live |
| 1 | Migrasi 3 tabel + skeleton halaman + route API + RBAC | build lolos, health 200 |
| 2 | Tab A (bawah rata², auto + takziran) | E2E: kandidat muncul dari nilai real |
| 3 | Tab B (juz amma, checklist per kelas) | E2E: rentang surat per kelas benar |
| 4 | Tab C (kompetensi + filter kelas) | E2E: 3 tsn/1-3 aly tampil, kelas lain kosong |
| 5 | Ekspor + view wali + banner syarat | E2E role matrix (pimpinan/mufatish/mustahiq/wali) |

Tiap fase: `go build` → `node --check` → docker build di VPS 1 → health 200 →
commit+push. Tabel di-live dibuat sebelum kode dipasang (DDL dulu, kode belakang)
agar tidak ada kode menunggu tabel.

## 9. Keputusan Owner (2026-10-01, final)

1. **I'dadiyah tidak ikut setoran Juz Amma** → Tab B hanya ibt 4–6, tsn 1–3,
   aly 1–3. Siswa I'dadiyah tidak muncul di tab ini.
2. **Evaluasi Juz Amma** = pilihan `Lulus / Her / Tidak Lulus` (sama seperti
   Nilai Kompetensi), terpisah dari kolom Selesai/Belum.
3. **Rata² 4,4 dihitung kecuali akhlaq** → exclude kategori
   `akhlaq_perilaku` DAN `akhlaq` (safety; kategori 'akhlaq' kosong di data).
   Catatan: mapel `علم الأخلاق` berkategori `umum` → TETAP ikut hitungan.
4. **Konsekuensi & Jenis Takziran = teks bebas** (kolom TEXT, tanpa dropdown).
5. **Mustahiq dibatasi cakupan** seperti menu akademik — pakai pola
   `penilaianScopeGuard*` / daftar bagian cakupan yang sama.

## 10. Referensi internal

- Pipeline nilai lama: `references/penilaian-pipeline.md`
- Recipe rename nav: `references/frontend-nav-and-lockdown.md`
- Menu per role: `references/role-menu-and-cakupan.md`
- Deploy/build VPS 1: `references/install-deploy.md`
