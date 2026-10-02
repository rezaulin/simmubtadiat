# CATATAN KERJA: Penilaian Tambahan — Sisa Fase 2–5

> **Untuk agent/mesin yang kerja di VPS 1** (`root@40.160.4.164`, repo `/opt/simmubtadiat`).
> Fase 1 sudah DONE & live (commit `5bb1ef2` + `0323ffb`, 2026-10-02). Dokumen desain
> lengkap: `docs/penilaian-tambahan-design.md` (baca dulu sebelum mulai).
> Catatan ini = daftar sisa pekerjaan + kontrak API yang sudah ada.

## Status ringkas

| Fase | Isi | Status |
|------|-----|--------|
| 0 | Rename label | ❌ Dibatalkan (revert) — jangan diulang |
| 1 | 3 tabel + tab bar + API + RBAC + render baca | ✅ DONE, live |
| 2 | Tab "Di Bawah Rata²": kontrol input takziran + save | ⬜ BELUM |
| 3 | Tab "Setoran Juz Amma": aktifkan ceklis + evaluasi + save | ⬜ BELUM |
| 4 | Tab "Nilai Kompetensi": aktifkan select hasil + save | ⬜ BELUM |
| 5 | Ekspor/download + akses wali + role matrix E2E | ⬜ BELUM |

**Prinsip: backend POST untuk fase 2–4 SUDAH ADA. Sisa pekerjaan murni frontend
(mengaktifkan kontrol yang sudah dirender `disabled` + wiring fetch POST + E2E).**

## Yang sudah hidup (jangan diulang / jangan diubah sembarangan)

- **Tabel** (migrasi `054_penilaian_tambahan.sql`, sudah dijalankan lokal + VPS):
  `penilaian_takziran`, `setoran_juz_amma`, `nilai_kompetensi`.
- **Route** (main.go, blok `/api/penilaian-tambahan`):
  - GET `/bawah-rata` · GET `/juz-amma` · GET `/kompetensi`
    → roles `pimpinan, mufatish, mustahiq` (cakupan bagian otomatis via
    `models.GetBagianForPenilaian`).
  - POST `/bawah-rata/takziran` · POST `/juz-amma` · POST `/kompetensi`
    → roles `pimpinan` ONLY (keputusan owner).
- **Handler**: `handlers/penilaian_tambahan.go` · **Models**: `models/penilaian_tambahan.go`.
- **Frontend**: `frontend/penilaian.html` (tab bar `#ptab-bar`, 4 panel
  `#tab-akademik|bawah-rata|juz-amma|kompetensi`), controller
  `frontend/src/js/penilaian-tambahan.js`.
- Kontrol interaktif fase 2–4 **sudah dirender dengan `disabled`** — tinggal
  aktifkan + tambah event handler, jangan bikin elemen baru dari nol.

## Fase 2 — Tab "Di Bawah Rata²" (input takziran)

Kolom sudah tampil: No, Nama, Bagian, Jumlah Nilai, Rata², Konsekuensi, Jenis
Takziran, Dalam Masa Takziran (checkbox), Selesai Takziran (checkbox).

1. Ganti 2 sel teks (`konsekuensi`, `jenis_takziran`) jadi `<input type="text">`
   **teks bebas** (bukan dropdown — keputusan owner). Default nilai dari row
   (`r.konsekuensi` / `r.jenis_takziran`, bisa null).
2. Aktifkan 2 checkbox (hapus `disabled`).
3. Simpan via:
   ```json
   POST /api/penilaian-tambahan/bawah-rata/takziran
   {"tahun_ajaran":"2026/2027","items":[
     {"santri_id":105,"kuartal":1,"konsekuensi":"...","jenis_takziran":"...",
      "dalam_masa":true,"selesai":false}]}
   ```
   (`tahun_ajaran` boleh dikosongkan → otomatis tahun aktif.)
4. UX: simpan per-baris (blur/change) atau tombol "Simpan" per baris — bebas,
   yang penting jangan ganggu kolom lain. Refresh GET setelah save sukses.
5. **Baris TIDAK dihapus** walau rata² naik atau `selesai=true` (keputusan owner).
6. Filter `br-dalam` / `br-selesai` sudah jalan (backend) — pastikan tombol
   "Tampilkan" tetap memanggil GET dengan param `dalam_masa`/`selesai`.

## Fase 3 — Tab "Setoran Juz Amma"

Kolom: No, Bagian, Nama Siswi, chip surat (checkbox `data-santri`+`data-surat`,
sudah dirender disabled), badge Evaluasi, badge Selesai/Belum.

1. Aktifkan checkbox chip → POST toggle per surat:
   ```json
   POST /api/penilaian-tambahan/juz-amma
   {"santri_id":123,"surat_no":110,"setor":true}
   ```
   Backend membuat baris lengkap 114..target otomatis (`ensureSetoranRows`).
2. Badge Evaluasi → ganti jadi `<select>` (Lulus/Her/Tidak Lulus) + badge
   Selesai/Belum → `<select>` (Selesai/Belum). POST per santri:
   ```json
   {"santri_id":123,"evaluasi":"lulus","status":"selesai"}
   ```
   (`evaluasi`/`status` di-simpan ke SEMUA baris surat santri tsb.)
3. Filter `ja-status` / `ja-evaluasi` / `ja-bagian` sudah jalan di backend.
4. Rentang surat per kelas sudah benar (terverifikasi E2E: ibt4=108 … aly3=78;
   I'dadiyah TIDAK muncul — jangan tambahkan).

## Fase 4 — Tab "Nilai Kompetensi"

Kolom: No, Nama, `<select class="km-select" disabled>` (sudah ada, value:
`""`/`lulus`/`her`/`tidak_lulus`).

1. Hapus `disabled`, pasang `change` handler → POST:
   ```json
   POST /api/penilaian-tambahan/kompetensi
   {"santri_id":123,"kategori":"ubq","hasil":"lulus"}
   ```
   Backend **validasi kelas** (`KompetensiEligible`): ubq = 3 tsn + 2 aly;
   praktik = 3 tsn + 1 aly + 3 aly; kitab = 3 tsn + 3 aly → di luar itu 400.
2. Filter `km-kategori`, `km-hasil`, `km-bagian` sudah jalan.
3. E2E: kategori Praktik → hanya 3 tsn+1 aly+3 aly; kelas lain kosong.

## Fase 5 — Ekspor + akses wali + role matrix

- **Download/export**: PIMPINAN ONLY, cek role di BACKEND (jangan cuma sembunyi
  tombol). Format ikut pola export tab Akademik (ExcelJS di
  `frontend/src/js/penilaian.js`).
- **Akses lihat**: pimpinan, mufatish, mustahiq, **walisantri** (wali hanya
  data anaknya). Wali BELUM masuk `RequireRoles` GET — tambahkan + filter
  `santri_id` milik anak saat fase 5. Tambah wali ke `ROLE_TAMBAHAN` di
  `penilaian-tambahan.js` saat itu juga.
- Role matrix E2E wajib: pimpinan (full), mufatish/mustahiq (lihat, cakupan),
  wali (hanya anak), admin/tim_rapot/muroqib (**tidak lihat** tab tambahan —
  sesuai spek; kalau boss minta ditambah, ubah `ROLE_TAMBAHAN` + `RequireRoles`).

## Pola kerja & jebakan (dari Fase 1)

1. **Edit di mana saja boleh** — repo di VPS 1 dan lokal sudah sinkron via
   GitHub (`github.com/rezaulin/simmubtadiat`). Kalau kerja di VPS 1: `git pull`
   dulu (VPS 1 punya deploy key); commit+push dari VPS 1 boleh.
2. **Build**: `cd frontend && npm install && npm run build` (jangan `npx vite build`
   — bisa ditolak shell; pakai `npm run build`). Go: `go build .` (error di
   `scripts/` & `tmp/` itu pre-existing, abaikan).
3. **Deploy**: `docker compose up -d --build app` di `/opt/simmubtadiat` →
   cek `curl 127.0.0.1:8090/api/health` = 200 → cek isi CONTAINER
   (`docker exec simmubtadiat-app-1 grep … /app/public/dist/…`), bukan file host.
4. **Cache**: file JS di-dist dapat `?v=` timestamp setiap build; kalau ragu
   halaman lama, tambah `?cb=$(date +%s)` di URL HTML untuk bust cache CF.
5. **E2E Playwright** (login `admin`/`admin123`, POST `/api/login` juga bisa
   via curl + cookie):
   - `wait_until="domcontentloaded"` (**jangan `networkidle`** — timeout, ada
     resource eksternal yang tak pernah idle).
   - Setelah buka `penilaian.html`, tunggu `.ptab-btn[aria-selected="true"]`
     (= init `/api/me` selesai) sebelum klik tab.
   - Tunggu isi container dengan `wait_for_function` (bukan `:has-text`, regex
     aman): innerText tidak lagi mengandung "Memuat".
6. **Race fix jangan di-revert**: `visible` di `penilaian-tambahan.js` sengaja
   optimistik `true` sebelum init supaya klik tab lebih dulu tetap dihormati.
7. **Komentar kode bisa hilang** oleh minifier — verifikasi deploy lewat perilaku
   (Playwright), bukan grep komentar.
8. **DDL didahulukan** sebelum kode yang memakai tabel (pola repo ini).

## Definisi selesai tiap fase

`go build .` lolos → `npm run build` lolos → docker build VPS → health 200 →
E2E Playwright bukti data (screenshot ke `/root/…`) → commit+push → tandai ✅ di
tabel atas dan di `docs/penilaian-tambahan-design.md` §8.
