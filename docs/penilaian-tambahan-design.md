# Desain: Pengembangan Menu Penilaian → 4 Aspek

> Status: DRAF ANALISA (belum ada kode fitur baru yang diubah)
> Tanggal: 2026-10-01 (revisi struktur: 2026-10-02)
> Sumber spesifikasi: permintaan owner (chat).

## 1. Ringkasan

Menu **Penilaian** (nama sidebar TIDAK berubah) berkembang jadi 4 aspek,
dipisahkan sebagai **TAB di dalam `penilaian.html`** — bukan menu/halaman
terpisah, dan tidak dicampur jadi satu layar:

| # | Tab | Status |
|---|-----|--------|
| 1 | **Akademik** | Isi LAMA (spreadsheet kuartal→khos→AM→bayan) — TIDAK disentuh |
| 2 | **Di Bawah Rata² (4,4)** | BARU — auto dari nilai akademik + input takziran manual |
| 3 | **Setoran Juz Amma** | BARU — checklist surat per kelas + evaluasi |
| 4 | **Nilai Kompetensi** | BARU — UBQ / Ujian Praktik / Baca Kitab (Lulus–Her–Tidak Lulus) |

**Koreksi keputusan owner (2026-10-02):**
- Jangan dicampur penilaian akademik dengan menu baru → tiap aspek **tab sendiri**.
- Tetap dalam **satu menu "Penilaian"** (rename "Penilaian Akademik" DIBATALKAN,
  commit rename di-revert).
- Bukan satu halaman panjang → tiap tab adalah tampilan sendiri, konten hanya
  muncul saat tab dipilih.

**Prinsip:** pipeline lama (kuartal → khos → AM → bayan, kunci 3 lapis) tidak
disentuh. Tidak ada kolom/tabel lama yang dimodifikasi — semua murni tambahan.

## 2. Struktur menu & tab

```
Sidebar: Penilaian  →  /penilaian.html   (satu-satunya menu, nama asli)
─────────────────────────────────────────────────────────────
[ Tab: Akademik | Di Bawah Rata² | Setoran Juz Amma | Nilai Kompetensi ]

Tab 1 "Akademik"      = spreadsheet lama persis seperti sekarang
Tab 2 "Bawah Rata²"   = semua kelas
Tab 3 "Juz Amma"      = ibt 4–6, tsn 1–3, aly 1–3 (I'dadiyah TIDAK)
Tab 4 "Kompetensi"    = khusus 3 tsn, 1/2/3 aly
```

- URL hash per tab: `#akademik` (default), `#bawah-rata`, `#juz-amma`,
  `#kompetensi` → bisa share link langsung ke tab.
- Tab baru di-load **lazy** (JS dinamis) — halaman lama tidak ikut menanggung
  beban kode tab baru sampai tab itu dibuka.
- Nav sidebar: **tidak ada penambahan item** (tidak ada "Penilaian Tambahan").

## 3. Akses (RBAC)

| Aksi | Role |
|------|------|
| Input/edit nilai tambahan (tab 2–4) | **pimpinan** saja |
| Download/ekspor data tab 2–4 | **pimpinan** saja (sementara) |
| Lihat tab 2–4 (read-only) | pimpinan, mufatish, mustahiq, walisantri |
| Tab 1 "Akademik" | role yang hari ini boleh buka penilaian.html (pimpinan, admin, mustahiq, tim_rapot; view: + mufatish, muroqib) — **walisantri TIDAK dapat tab ini** |

- **Walisantri**: hanya membuka tab 2–4, hanya data **anaknya sendiri**
  (via `wali_santri_link`); kalau wali membuka `penilaian.html`, tab "Akademik"
  disembunyikan dan kontrol input tidak dirender.
- Backend tetap mengunci: `POST` → `RequireRoles("pimpinan")`; `GET` tab 2–4 →
  `pimpinan/mufatish/mustahiq` + special-case `wali_santri` (filter anak).
- **Mustahiq dibatasi cakupan bagian** seperti menu akademik (pola
  `penilaianScopeGuard*` / `GetBagianPenilaian`).

## 4. Skema Database (3 tabel BARU)

```sql
-- Tab 2: status takziran (nilai TIDAK disimpan — selalu live dari nilai_kuartal)
CREATE TABLE penilaian_takziran (
  id              SERIAL PRIMARY KEY,
  santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  kuartal         INT NOT NULL CHECK (kuartal BETWEEN 1 AND 4),
  tahun_ajaran    VARCHAR(9) NOT NULL,
  konsekuensi     TEXT,                       -- teks bebas
  jenis_takziran  TEXT,                       -- teks bebas
  dalam_masa      BOOLEAN NOT NULL DEFAULT false,   -- "Dalam masa Takziran" ✔
  selesai         BOOLEAN NOT NULL DEFAULT false,   -- "Selesai Melaksanakan" ✔
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (santri_id, kuartal, tahun_ajaran)
);

-- Tab 3: setoran Juz Amma (satu baris per santri × surat)
CREATE TABLE setoran_juz_amma (
  id              SERIAL PRIMARY KEY,
  santri_id       INT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  surat_no        INT NOT NULL CHECK (surat_no BETWEEN 78 AND 114),
  setor           BOOLEAN NOT NULL DEFAULT false,  -- ceklis nama surat
  evaluasi        VARCHAR(20) CHECK (evaluasi IN ('lulus','her','tidak_lulus')),
  status          VARCHAR(10) NOT NULL DEFAULT 'belum'
                    CHECK (status IN ('selesai','belum')),
  tahun_ajaran    VARCHAR(9) NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (santri_id, surat_no, tahun_ajaran)
);

-- Tab 4: nilai kompetensi
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

### Tab 2 — Nilai Di Bawah Rata² (4,4)

- **Otomatis**: rata-rata `nilai_kuartal` per santri per kuartal (TA aktif),
  semua mapel yang bernilai **KECUALI kategori akhlaq**
  (`kategori NOT IN ('akhlaq','akhlaq_perilaku')`). Skala data **0–10**.
- Kandidat muncul bila `AVG(nilai) < 4.4`. Baris **tetap tersimpan** walau
  takziran selesai; kalau rata² nanti naik di atas 4,4 baris tidak dihapus.
- Kolom: Nomer · Nama · Bagian · Jumlah nilai (SUM) · Rata² Nilai (AVG) ·
  Konsekuensi (teks) · Jenis Takziran (teks) · Dalam masa Takziran (✔) ·
  Selesai (✔)
- Filter: **Dalam masa takziran** & **Selesai takziran** (ya/tidak) + selector
  kuartal + tahun ajaran.

### Tab 3 — Setoran Juz Amma

- **Satu baris per siswi**: cell "Nama surat" = deret **ceklis** surat sesuai
  rentang kelasnya (urut dari an-Nas ke bawah), dropdown **Evaluasi**
  (`Lulus / Her / Tidak Lulus`), model pilih **Selesai/Belum**.

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

- Rentang = konstanta backend (map kelas → `surat_no` target). **I'dadiyah tidak
  punya entri → siswanya tidak tampil.**
- Filter: **Selesai / Belum Selesai** + **Evaluasi**.
- Banner: *"Lulus setoran Juz Amma menjadi syarat mengikuti ujian semester
  genap · Batas akhir: Kuartal 2"*.

### Tab 4 — Nilai Kompetensi

- 3 kategori + filter: `Ujian Baca Al-Qur'an (UBQ)` · `Ujian Praktik` ·
  `Ujian Baca Kitab`. Isi: **Lulus / Her / Tidak Lulus** (model pilih).
- Nama & bagian dari sumber yang sama dengan fitur Nilai Akademik.
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
- Keterangan jadwal: tajhiz al-mayit di 1 aly, UBQ di 2 aly, baca kitab di
  3 aly; tsanawiyah ketiganya di 3 tsn.

## 6. API (prefiks `/api/penilaian-tambahan`, semua BARU)

```
GET  /bawah-rata?kuartal=&tahun_ajaran=&dalam_masa=&selesai=   (auto-compute)
POST /bawah-rata/takziran        {santri_id, kuartal, konsekuensi, jenis, dalam_masa, selesai}
GET  /juz-amma?bagian_id=&status=&evaluasi=&tahun_ajaran=
POST /juz-amma                   {santri_id, surat_no, setor, evaluasi, status}
GET  /kompetensi?kategori=&hasil=&bagian_id=&tahun_ajaran=
POST /kompetensi                 {santri_id, kategori, hasil}
GET  /export?fitur=bawah-rata|juz-amma|kompetensi&...          (pimpinan only)
GET  /wali/anak              (khusus wali_santri → read-only data anak)
```

- Semua `GET` wajib terapkan cakupan mustahiq + filter anak utk wali.
- `POST` dibungkus `RequireRoles("pimpinan")`.
- Ekspor mengikuti pola `ExportSantri`/`ExportPengajar` (`GET .../export`).

## 7. Frontend

1. **Nav sidebar: TIDAK diubah** — item tetap "Penilaian" (rename sudah
   di-revert, lihat §1). Tidak ada menu baru di 19 file HTML.
2. **Tab bar di `penilaian.html`** (markup vanilla di atas konten yang ada):
   - Tab "Akademik" = wrapper konten lama (spreadsheet) — tanpa perubahan logika.
   - Slot konten untuk tab 2–4 (kosong, diisi lazy oleh JS).
   - Tab aktif dari URL hash; ganti tab → ganti `location.hash`.
   - Tampilan tab untuk role: wali_santri → sembunyikan tab "Akademik";
     mufatish/muroqib → tab 2–4 read-only; dst.
3. **JS baru** `frontend/src/js/penilaian-tambahan.js` (di-bundle terpisah,
   di-import dinamis saat tab baru pertama dibuka):
   - `renderBawahRata()`, `renderJuzAmma()`, `renderKompetensi()` + toolbar
     filter sesuai §5, tombol simpan/unduh hanya bila role pimpinan.
4. **Kesehatan halaman lama**: pastikan DOM spreadsheet lama (id/jenis) tidak
   bentrok dengan markup tab; `loadSpreadsheet()` hanya jalan saat tab
   "Akademik" aktif (atau tetap jalan seperti sekarang — tidak diubah).
5. **MENU_ACCESS `xss.js`**: `/penilaian.html` ditambah `wali_santri` (agar
   wali bisa membuka tab baru) — backend spreadsheet tetap menolak wali,
   tab Akademik disembunyikan di UI.

## 8. Fase Pengerjaan

| Fase | Isi | Output |
|------|-----|--------|
| 0 | ~~Rename label~~ **DIBATALKAN (revert)** — sudah dikembalikan | label "Penilaian" kembali live |
| 1 | Migrasi 3 tabel + tab bar + route API + RBAC + render baca (ketiganya) | ✅ **DONE 2026-10-02** (`5bb1ef2`+`0323ffb`): E2E live — Bawah Rata 1 baris (Maryam 3,87), Juz Amma 25 siswi tanpa I'dadiyah, Kompetensi UBQ 14 / Praktik 8, tab Akademik utuh |
| 2 | Tab "Bawah Rata-rata": kontrol input takziran (konsekuensi/jenis teks bebas + ceklis) + save | ✅ **DONE 2026-10-02**: E2E 28/28 — simpan teks via blur & ceklis persist ke DB, filter `dalam_masa`/`selesai` jalan, kontrol AKTIF utk pimpinan & DISABLED utk mufatish, POST non-pimpinan 403, label jadi "Di Bawah Rata-rata" |
| 3 | Tab "Juz Amma": aktifkan ceklis + evaluasi/status + save | ✅ **DONE 2026-10-02**: E2E 32/32 — toggle chip per surat & select Evaluasi/Selesai persist ke DB, indikator "✓ Tersimpan", filter `ja-status` jalan, chip AKTIF utk pimpinan & DISABLED utk mufatish, POST non-pimpinan 403. Bug backend ikut diperbaiki: `ensureSetoranRows` ($3→$2) & `COALESCE(evaluasi)` di GET |
| 4 | Tab "Kompetensi": aktifkan select hasil + save | ✅ **DONE 2026-10-02**: E2E 29/29 — select hasil AKTIF utk pimpinan & DISABLED utk mufatish, POST per baris persist (indikator "✓ Tersimpan"), pilihan "(belum dinilai)" di-revert lokal (backend tolak hasil kosong), filter hasil + kategori jalan (ubq 14 / praktik 8 / kitab 4, aturan kelas owner terverifikasi), validasi 400 utk kelas tak eligible, POST non-pimpinan 403 |
| 5 | Ekspor + akses wali + banner syarat | ✅ **DONE 2026-10-02**: E2E role matrix 41/41 — export xlsx pimpinan-only (validasi role di route + handler, pola ExportSantri/excelize), wali terfilter hanya anak (wali_santri_link) + `/wali/anak` + banner Akses Wali + tab Akademik hidden, admin/tim_rapot GET 403 & tab tambahan hidden. Bug fix: `activate()` tak lagi menghapus class `hidden` tab |

Tiap fase: `go build` → `node --check` → docker build di VPS 1 → health 200 →
commit+push. DDL tabel didahulukan sebelum kode yang memakainya dipasang.

**Audit spek vs implementasi (2026-10-02)**: seluruh spek owner disilang ulang —
✅ semua kolom/filter/rentang surat/akses sesuai; 2 perbaikan: banner syarat
ijazah jadi **kondisional per kelas** (`updateKmNotes()`, E2E audit 7/7) +
label kolom "Selesai Melaksanakan Takziran" (A) & "Selesai/Belum Selesai" (B).
Regresi role matrix tetap 41/41.

## 9. Keputusan Owner (final)

1. **I'dadiyah tidak ikut setoran Juz Amma** → Tab Juz Amma hanya ibt 4–6,
   tsn 1–3, aly 1–3.
2. **Evaluasi Juz Amma** = `Lulus / Her / Tidak Lulus` (terpisah dari
   Selesai/Belum).
3. **Rata² 4,4 kecuali akhlaq** → exclude kategori `akhlaq_perilaku` & `akhlaq`
   (kategori 'akhlaq' kosong di data; `علم الأخلاق` berkategori `umum` → ikut).
4. **Konsekuensi & Jenis Takziran = teks bebas** (kolom TEXT).
5. **Mustahiq dibatasi cakupan** seperti menu akademik.
6. **Struktur (koreksi 2026-10-02)**: tetap satu menu **"Penilaian"**; aspek
   baru = **tab-tab sendiri di dalam penilaian.html**; akademik & tambahan
   tidak dicampur; bukan satu halaman panjang; rename label dibatalkan.

## 10. Referensi internal

- Pipeline nilai lama: `references/penilaian-pipeline.md`
- Nav sidebar (19 file, tanpa partial): `references/frontend-nav-and-lockdown.md`
- Menu per role: `references/role-menu-and-cakupan.md`
- Deploy/build VPS 1: `references/install-deploy.md`
