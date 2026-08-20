# PANDUAN KERJA — Aplikasi Mubtadiaat
> Dokumen ini adalah panduan kerja lengkap pembangunan aplikasi.
> Jadikan referensi utama selama pengerjaan.

**Versi:** 1.2.0
**Database:** PostgreSQL
**Tanggal dibuat:** 2026-07-12
**Status:** ✅ Semua pertanyaan terjawab — SIAP EKSEKUSI

---

## DAFTAR ISI

1. [Ringkasan Sistem](#1-ringkasan-sistem)
2. [Keputusan Desain (Jawaban Open Questions)](#2-keputusan-desain)
3. [Tech Stack](#3-tech-stack)
4. [Infrastruktur & Deployment](#4-infrastruktur--deployment)
5. [Arsitektur Folder](#5-arsitektur-folder)
6. [Keamanan (Security Design)](#6-keamanan-security-design)
7. [Role & Hak Akses](#7-role--hak-akses)
8. [Schema Database (ERD)](#8-schema-database-erd)
9. [Desain Penyimpanan Absensi](#10-desain-penyimpanan-absensi)
10. [Alur Perpindahan Kelas & Kelulusan → Alumni](#9-alur-perpindahan-kelas--kelulusan)
11. [Logika Penilaian](#11-logika-penilaian)
12. [Fitur-Fitur Aplikasi](#12-fitur-fitur-aplikasi)
13. [Menu & Navigasi](#13-menu--navigasi)
14. [Pedoman UI/UX (Referensi Visual)](#14-pedoman-uiux-referensi-visual)
15. [Urutan Pengerjaan](#15-urutan-pengerjaan)
16. [Checklist Verifikasi](#16-checklist-verifikasi)

---

## 1. Ringkasan Sistem

Aplikasi **Mubtadiaat** adalah sistem informasi manajemen madrasah diniyyah berbasis web, fokus pada:
- Manajemen data santri, alumni (semua santri yang keluar), pengajar, dan dewan harian
- Sistem penilaian akademik (Kuartal, Semester, Rapot, Al-Bayan) dengan kalkulasi otomatis
- Kontrol akses berbasis peran (6 role) yang granular
- Penyimpanan histori data **permanen** dari tahun ke tahun — tidak ada data yang dihapus

---

## 2. Keputusan Desain

Semua pertanyaan desain sudah terjawab. Berikut keputusan final yang **wajib dipakai sebagai acuan coding**:

| # | Pertanyaan | Keputusan Final |
|---|---|---|
| Q1 | Apa itu "bagian"? | 1 angkatan punya beberapa bagian: **A1, A2, dst.** Struktur: `angkatan` → `bagian` |
| Q2 | Satu santri bisa banyak kelas? | **Tidak.** Selalu 1 bagian per waktu |
| Q3 | Mata pelajaran sama semua kelas? | **Dinamis per bagian.** Tapi umumnya 1 angkatan mapelnya sama, jadwal beda. Naik kelas → mapel baru |
| Q4 | Her Ujian: replace atau terpisah? | **Dicatat terpisah** (`is_her = true`), bisa diedit. Sistem pakai nilai Her untuk kalkulasi |
| Q5 | Nilai 'Am: otomatis atau manual? | **Otomatis, tapi bisa diedit manual** |
| Q6 | Login wali santri pakai apa? | **NIK santri** sebagai username, **wajib ganti password** saat login pertama. Admin set password awal = NIK |
| Q7 | Rapot export PDF? | **Tampil di layar + bisa cetak browser.** Header 2–3 baris custom, identitas santri (nama, alamat, tingkatan, logo madrasah), bahasa Arab |
| Q8 | Absensi Bi Idzni/Ghoirihi apa? | **Bi Idzni = izin (termasuk sakit & keperluan apapun). Bi Ghoirihi = alpha (tanpa keterangan)** |

### Keputusan Tambahan (dari diskusi)

| Topik | Keputusan |
|---|---|
| **Alumni** | **SEMUA santri yang keluar jadi alumni** (lulus, boyong, dropout). Dibedakan lewat `status_keluar`. Kolom khidmah & ijazah hanya untuk yang `lulus` |
| **Mustahiq naik kelas** | Saat batch naik kelas, mustahiq ikut pindah bagian otomatis (bisa dikonfirmasi admin sebelum dieksekusi) |
| **Schema perpindahan** | ✅ Sudah ada di plan via tabel `riwayat_bagian` (close baris lama, insert baris baru) |
| **Mapel naik kelas** | Bagian baru = mapel **dibuat dari nol** oleh admin (tidak dikopi otomatis) |
| **Mufatish scope** | Mufatish lihat **semua bagian** dalam tingkatan yang ditugaskan (contoh: A1+A2+A3 Ibtidaiyyah semuanya) |
| **Foto santri** | **Opsional** — bisa upload, bisa tidak. Field `foto_url` nullable |
| **Login wali (first login)** | Username=NIK, password awal=NIK, sistem paksa ganti password di login pertama (`is_password_changed = false`) |

---

## 3. Tech Stack

| Layer | Teknologi | Versi | Alasan |
|---|---|---|---|
| **Backend** | Go (net/http) | 1.22+ | Ringan, compile jadi binary kecil |
| **Database** | PostgreSQL | 16 | Robust, cocok data historis kompleks |
| **Auth** | Session cookie + bcrypt | — | Aman, sederhana untuk internal |
| **Frontend** | HTML + **Tailwind CSS v3** + Vanilla JS | v3.x | Utility-first, hasil CSS kecil setelah build |
| **PWA** | Web App Manifest + Service Worker | — | Install ke homescreen, offline-ready |
| **Build Tool** | Vite | v5 | Dev server + HMR Tailwind, bundling JS |
| **Container** | Docker + Docker Compose | — | Konsisten dev ↔ prod, mudah deploy VPS |
| **Web Server** | Nginx (reverse proxy) | alpine | Serve static, proxy ke Go backend |
| **Deployment** | VPS Linux | Ubuntu 22.04 | Full kontrol, docker-compose up |

### Alur Build Frontend

```
[Source: src/]
  ├── input.css       (Tailwind directives)
  ├── js/             (Vanilla JS modules)
  └── index.html
        ↓
   Vite build
        ↓
[Output: public/dist/]
  ├── assets/index-[hash].css   (Tailwind compiled)
  └── assets/index-[hash].js    (JS bundled)
```

### PWA Requirements

```
manifest.json          ← nama app, icon, theme color, start_url
service-worker.js      ← cache shell + API responses
icons/                 ← 192x192, 512x512 (maskable)
```

Fitur PWA:
- ✅ Install ke homescreen (Android/iOS)
- ✅ Splash screen & icon app
- ✅ Offline: tampilkan halaman cached saat tidak ada koneksi
- ✅ Background sync (absensi & nilai bisa antri jika offline)

---

## 4. Infrastruktur & Deployment

### Diagram Infrastruktur

```
┌─────────────────────────────────────────────────┐
│                  VPS Linux (Ubuntu)              │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │           Docker Compose                │    │
│  │                                         │    │
│  │  ┌──────────┐    ┌──────────────────┐   │    │
│  │  │  nginx   │───►│  go-app :8080    │   │    │
│  │  │  :80/443 │    │  (Go binary)     │   │    │
│  │  │  static  │    │  + /api/*        │   │    │
│  │  └──────────┘    └────────┬─────────┘   │    │
│  │                           │              │    │
│  │                  ┌────────▼─────────┐   │    │
│  │                  │   postgres :5432  │   │    │
│  │                  │   (volume: data/) │   │    │
│  │                  └──────────────────┘   │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
         ▲ deploy: git pull + docker compose up -d
```

### File Konfigurasi Docker

**`Dockerfile`** — Multi-stage build:
```
Stage 1 (node:20-alpine):
  - npm install
  - npm run build   ← Vite build Tailwind + JS
  - Output: dist/

Stage 2 (golang:1.22-alpine):
  - go build -o mubtadiaat .
  - Output: binary

Stage 3 (alpine:latest):
  - COPY binary dari Stage 2
  - COPY dist/ dari Stage 1 → /app/public/
  - EXPOSE 8080
  - CMD ["./mubtadiaat"]
```

**`docker-compose.yml`** — Untuk lokal & VPS (sama):
```yaml
services:
  app:
    build: .
    ports: ["8080:8080"]
    env_file: .env
    depends_on: [db]

  db:
    image: postgres:16-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
    env_file: .env

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf
      - ./nginx/ssl:/etc/nginx/ssl      # untuk HTTPS
    depends_on: [app]

volumes:
  postgres_data:
```

**`.env`** — Template (jangan di-commit ke git):
```
DB_HOST=db
DB_PORT=5432
DB_NAME=mubtadiaat
DB_USER=mubtadiaat_user
DB_PASS=ganti_password_kuat_ini
APP_SECRET=ganti_secret_key_panjang
APP_PORT=8080
APP_ENV=production
```

### Alur Deploy ke VPS

```bash
# 1. Di VPS (pertama kali)
git clone <repo> /opt/mubtadiaat
cd /opt/mubtadiaat
cp .env.example .env   # isi credentials
docker compose up -d --build

# 2. Update (setelah ada perubahan)
git pull
docker compose up -d --build   # rebuild otomatis

# 3. Review lokal (developer)
cd mubtadiaat
cp .env.example .env   # ubah DB_HOST=localhost jika perlu
docker compose up      # sama persis dengan VPS
```

### Alur Development Lokal (tanpa Docker)

```bash
# Terminal 1 — Database
docker compose up db   # hanya jalankan postgres

# Terminal 2 — Frontend (Vite HMR)
cd frontend
npm run dev            # Vite dev server + Tailwind watch

# Terminal 3 — Backend Go
go run main.go         # Go backend dengan hot-reload (air)
```

### Struktur File Docker

```
mubtadiaat/
├── Dockerfile
├── docker-compose.yml
├── .env.example               ← template, COMMIT ini
├── .env                       ← JANGAN commit!
├── .dockerignore
└── nginx/
    ├── nginx.conf             ← reverse proxy config
    └── ssl/                   ← cert HTTPS (opsional)
```

---

## 5. Arsitektur Folder

```
mubtadiaat/
│
├── ── DOCKER & INFRA ──
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .env                       ← JANGAN commit ke git
├── .dockerignore
├── nginx/
│   └── nginx.conf
│
├── ── BACKEND (Go) ──
├── main.go                    ← Entry point, router, static file server
├── go.mod / go.sum
│
├── config/
│   └── db.go                  ← Koneksi PostgreSQL
│
├── migrations/
│   ├── 001_init.sql           ← Core tables (users, sessions, settings)
│   ├── 002_master.sql         ← tingkatan, angkatan, bagian, santri
│   ├── 003_pengajar.sql       ← pengajar, pengajar_bagian, dewan_harian
│   ├── 004_nilai.sql          ← mata_pelajaran, nilai_kuartal, nilai_khos, dll.
│   ├── 005_absensi.sql        ← absensi_perizinan, rekap_absensi, kalender_kuartal
│   └── 006_alumni.sql         ← proses_keluar, alumni, riwayat_bagian
│
├── handlers/
│   ├── auth.go                ← Login (wali via NIK+force_change), logout, session
│   ├── santri.go              ← CRUD santri + assign bagian + foto
│   ├── kelas.go               ← Setup kelas baru, naik kelas batch, redistribusi
│   ├── perpindahan.go         ← Pindah bagian, cuti, reaktivasi, proses keluar
│   ├── alumni.go              ← CRUD alumni + update khidmah/ijazah
│   ├── pengajar.go            ← CRUD pengajar + pengajar_bagian (penugasan)
│   ├── dewan.go               ← CRUD dewan harian (P3HM, MPHM, M3PHM)
│   ├── mapel.go               ← CRUD mata_pelajaran per bagian
│   ├── nilai.go               ← Input nilai kuartal + kalkulasi otomatis
│   ├── absensi.go             ← Input absensi + update rekap_absensi (1 transaksi)
│   ├── kalender.go            ← CRUD kalender_kuartal (tanggal mulai-selesai)
│   ├── rapot.go               ← Kalkulasi Khos/Am/Al-Bayan + render rapot
│   ├── laporan.go             ← Rekap absensi, rekap Al-Bayan, rekap pengajar
│   ├── search.go              ← Pencarian global (santri, alumni, pengajar)
│   └── admin.go               ← Akun user, kolom dinamis, rapot_settings
│
├── middleware/
│   ├── auth.go                ← Cek session, inject user ke context
│   └── rbac.go                ← Role-based access control per endpoint
│
├── models/
│   ├── user.go                ← User, Session
│   ├── santri.go              ← Santri, RiwayatBagian, WaliSantriLink
│   ├── alumni.go              ← Alumni, ProsesKeluar
│   ├── bagian.go              ← Tingkatan, Angkatan, Bagian
│   ├── pengajar.go            ← Pengajar, PengajarBagian, DewanHarian
│   ├── mapel.go               ← MataPelajaran
│   ├── nilai.go               ← NilaiKuartal, NilaiKhos, NilaiAm, NilaiBayan
│   ├── absensi.go             ← AbsensiPerizinan, RekapAbsensi, KalenderKuartal
│   └── settings.go            ← Settings, RapotSettings, DynamicColumns
│
├── ── FRONTEND (Vite + Tailwind v3) ──
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js     ← Tailwind v3 config
    ├── postcss.config.js
    │
    ├── src/
    │   ├── main.js            ← Entry JS, router SPA
    │   ├── input.css          ← @tailwind directives
    │   ├── sw.js              ← Service Worker (PWA offline)
    │   │
    │   ├── pages/
    │   │   ├── login.js       ← Login + wali force change password
    │   │   ├── dashboard.js   ← Ringkasan per role
    │   │   ├── santri/
    │   │   │   ├── index.js   ← Daftar santri aktif per bagian
    │   │   │   ├── detail.js  ← Profil lengkap santri
    │   │   │   ├── form.js    ← Tambah / edit santri
    │   │   │   └── belum-kelas.js  ← Santri tanpa bagian + assign
    │   │   ├── kelas/
    │   │   │   ├── setup.js   ← Buat bagian baru
    │   │   │   └── naik.js    ← Proses naik kelas + redistribusi
    │   │   ├── alumni/
    │   │   │   ├── index.js   ← Daftar alumni + filter
    │   │   │   └── detail.js  ← Profil alumni + update khidmah/ijazah
    │   │   ├── pengajar/
    │   │   │   ├── index.js   ← Daftar pengajar
    │   │   │   └── rekap.js   ← Rekap penugasan mustahiq/munawwib
    │   │   ├── nilai/
    │   │   │   ├── kuartal.js ← Grid input nilai kuartal
    │   │   │   ├── khos.js    ← Kalkulasi & lihat nilai khos
    │   │   │   └── am.js      ← Nilai Am + edit manual
    │   │   ├── absensi.js     ← Input absensi harian per bagian
    │   │   ├── rapot/
    │   │   │   ├── semester.js ← Rapot per siswi
    │   │   │   └── bayan.js    ← Al-Bayan per bagian/angkatan
    │   │   ├── search.js      ← Pencarian global
    │   │   ├── arsip.js       ← Arsip semua santri + filter
    │   │   └── admin/
    │   │       ├── akun.js    ← CRUD user + reset password
    │   │       ├── kalender.js ← Setup tanggal kuartal per tahun ajaran
    │   │       ├── mapel.js   ← Kelola mapel per bagian
    │   │       ├── kolom.js   ← Kolom dinamis
    │   │       └── rapot-setting.js  ← Header rapot + logo
    │   │
    │   ├── components/
    │   │   ├── navbar.js
    │   │   ├── sidebar.js
    │   │   ├── modal.js
    │   │   ├── table.js       ← Reusable grid + sort + filter
    │   │   ├── toast.js
    │   │   ├── badge.js       ← Status badge (aktif/cuti/alumni)
    │   │   └── confirm.js     ← Dialog konfirmasi aksi destructive
    │   │
    │   └── utils/
    │       ├── api.js         ← fetch wrapper + error handling
    │       ├── auth.js        ← session state + role guard
    │       ├── format.js      ← nilai ½, tanggal, dll.
    │       └── kuartal.js     ← tentukan kuartal dari tanggal
    │
    └── public/
        ├── index.html         ← HTML shell + PWA meta tags
        ├── manifest.json      ← PWA manifest
        ├── offline.html       ← Halaman saat offline
        └── icons/
            ├── icon-192.png
            └── icon-512.png
```

> **Note:** Output `vite build` menghasilkan `frontend/dist/` yang di-copy ke `public/dist/` saat Docker build. Go backend serve file statis dari folder tersebut.

---

## 6. Keamanan (Security Design)

> **Prinsip utama:** Zero trust — semua validasi dilakukan di server, tidak ada kepercayaan pada data dari client.

---

### 6.1 Autentikasi & Session

#### Mekanisme Login

```
POST /api/auth/login
Body: { username, password }

Server:
  1. Cari user berdasarkan username
  2. bcrypt.CompareHashAndPassword(stored_hash, input_password)
  3. Jika cocok → buat session ID (UUID v4, random)
  4. Simpan session di tabel sessions (server-side)
  5. Set-Cookie: session_id=<UUID>; HttpOnly; Secure; SameSite=Strict; Path=/
  6. Catat di activity_log: action=login, ip=client_ip
```

#### Login Wali Santri (via NIK)

```
POST /api/auth/login-wali
Body: { nik }  ← NIK KTP santri

Server:
  1. Cari santri berdasarkan nik
  2. Cek ada di wali_santri_link
  3. Buat session dengan role=wali_santri, scope=santri_id
  4. Set cookie sama seperti login biasa
  ❌ NIK TIDAK pernah di-log atau ditampilkan di response
```

#### Session Management

| Parameter | Nilai | Alasan |
|---|---|---|
| Session ID | UUID v4 | Tidak bisa di-brute force |
| Penyimpanan | Server-side (tabel `sessions`) | Tidak ada data sensitif di cookie |
| Cookie flags | `HttpOnly; Secure; SameSite=Strict` | Blokir XSS + CSRF |
| Masa berlaku | 8 jam (aktif), 24 jam (idle) | Keseimbangan UX & keamanan |
| Refresh | Setiap request aktif → perpanjang | Session tidak mati saat pakai |
| Logout | DELETE dari tabel sessions | Session mati di server, bukan hanya clear cookie |

#### Rate Limiting Login

```
Max 5 percobaan login gagal per IP per 15 menit
→ jika melebihi: block IP sementara 30 menit
→ catat di activity_log (action=failed_login)
```

#### Password

```
Hashing  : bcrypt, cost factor = 12
Min length: 8 karakter
Kompleksitas: tidak dipaksakan (pengguna internal, admin yang atur)
Reset    : hanya admin (pimpinan) yang bisa reset password user lain
           → generate random password → admin berikan manual ke user
```

---

### 6.2 Otorisasi (RBAC — Server Side)

> **Aturan keras:** Semua pengecekan role & scope dilakukan di **middleware Go**, bukan di frontend.

#### Middleware Stack per Request

```
Request masuk
    │
    ├─ [1] AuthMiddleware
    │       Cek session cookie valid & belum expired
    │       Inject: ctx.user_id, ctx.role, ctx.scope
    │       → 401 Unauthorized jika gagal
    │
    ├─ [2] RBACMiddleware
    │       Cek role boleh akses endpoint ini
    │       → 403 Forbidden jika tidak boleh
    │
    ├─ [3] ScopeMiddleware
    │       Cek data yang diminta dalam scope user:
    │         mustahiq  → hanya data bagian yang ditugaskan
    │         mufatish  → hanya data tingkatan yang ditugaskan
    │         wali      → hanya data santri anaknya
    │         admin     → akses penuh (setara pimpinan)
    │       → 403 jika di luar scope
    │
    └─ [4] Handler (bisnis logic)
```

#### Filter Data per Role (Anti Data Leak)

```go
// Contoh: endpoint GET /api/santri
// Backend selalu filter berdasarkan role, TIDAK percaya request param

switch user.Role {
case "pimpinan":
    // tidak ada filter tambahan
    query = "SELECT * FROM santri WHERE ..."

case "mufatish":
    // hanya santri di tingkatan yang ditugaskan
    query = `SELECT s.* FROM santri s
             JOIN riwayat_bagian rb ON rb.santri_id = s.id
             JOIN bagian b ON b.id = rb.bagian_id
             JOIN mufatish_tingkatan mt ON mt.tingkatan_id = b.tingkatan_id
             WHERE mt.user_id = $1 AND rb.tanggal_keluar IS NULL`

case "mustahiq":
    // hanya santri di bagiannya saja
    query = `SELECT s.* FROM santri s
             JOIN riwayat_bagian rb ON rb.santri_id = s.id
             JOIN mustahiq_bagian mb ON mb.bagian_id = rb.bagian_id
             WHERE mb.user_id = $1 AND rb.tanggal_keluar IS NULL`

case "wali_santri":
    // hanya anak sendiri
    query = `SELECT s.* FROM santri s
             JOIN wali_santri_link wl ON wl.santri_id = s.id
             WHERE wl.user_id = $1`

case "admin":
    // akses penuh, setara pimpinan — tidak ada filter tambahan
    query = "SELECT * FROM santri WHERE ..."
}
```

---

### 6.3 Keamanan API (Backend)

#### HTTP Headers Wajib (via Nginx + Go)

```nginx
# nginx.conf
add_header X-Content-Type-Options    "nosniff"          always;
add_header X-Frame-Options           "DENY"             always;
add_header X-XSS-Protection          "1; mode=block"    always;
add_header Referrer-Policy           "strict-origin"    always;
add_header Permissions-Policy        "geolocation=(), camera=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Content Security Policy
add_header Content-Security-Policy
  "default-src 'self';
   script-src  'self';
   style-src   'self' 'unsafe-inline';
   img-src     'self' data:;
   font-src    'self';
   connect-src 'self';
   frame-ancestors 'none';" always;
```

#### CSRF Protection

```
Strategi: Double Submit Cookie + SameSite=Strict

1. Saat login berhasil → server kirim 2 cookie:
   - session_id: HttpOnly; Secure; SameSite=Strict
   - csrf_token: NOT HttpOnly (bisa dibaca JS); Secure; SameSite=Strict

2. Setiap request mutasi (POST/PUT/PATCH/DELETE):
   Frontend kirim header: X-CSRF-Token: <nilai dari cookie>

3. Backend verifikasi:
   cookie.csrf_token == header X-CSRF-Token
   → jika tidak cocok → 403 Forbidden
```

#### Rate Limiting (semua endpoint)

| Endpoint | Limit |
|---|---|
| `/api/auth/login` | 5 req/15 menit per IP |
| `/api/auth/login-wali` | 10 req/15 menit per IP |
| `/api/search` | 30 req/menit per user |
| Endpoint lain | 120 req/menit per user |
| Upload foto | 10 req/jam per user |

#### Validasi Input (Server-side, WAJIB)

```
Semua input divalidasi di backend — tidak percaya client:

Nilai kuartal:
  - Tipe: NUMERIC, range 0–10 (atau 0–8 untuk mapel tertentu)
  - Mendukung 0.5, tolak nilai negatif atau > nilai_max mapel

String fields:
  - Trim whitespace
  - Max length per field (nama: 100, alamat: 500, dll.)
  - Sanitasi karakter berbahaya sebelum disimpan

Date fields:
  - Format: YYYY-MM-DD
  - Validasi range (tidak boleh masa depan untuk tanggal lahir, dll.)

ID (FK references):
  - Validasi existensi di database (bukan hanya format integer)
  - Validasi scope: user tidak bisa referensikan ID di luar jangkauannya

File upload (foto):
  - Tipe: hanya image/jpeg, image/png, image/webp
  - Max size: 2MB
  - Rename ke UUID — tidak pakai nama file asli
  - Simpan di luar public root (akses via handler, bukan direct URL)
```

#### Prepared Statements (Cegah SQL Injection)

```go
// ✅ SELALU pakai prepared statement / parameterized query
row := db.QueryRow(`SELECT * FROM santri WHERE id = $1 AND status = $2`, id, status)

// ❌ JANGAN PERNAH string concatenation
query := "SELECT * FROM santri WHERE id = " + id  // BERBAHAYA
```

#### Request Size Limit

```go
// main.go
http.MaxBytesReader(w, r.Body, 5*1024*1024) // max 5MB per request
```

---

### 6.4 Keamanan Frontend

#### Tidak Ada Data Sensitif di Client

```
❌ Jangan simpan di localStorage / sessionStorage:
   - Session token (sudah di HttpOnly cookie)
   - Data nilai santri
   - NIK santri
   - Password apapun

✅ Boleh di memory (JavaScript variable, hilang saat refresh):
   - Role user (untuk UI saja, bukan untuk keputusan akses)
   - Data yang sedang ditampilkan
```

#### Output Encoding (Cegah XSS)

```javascript
// ✅ Selalu escape sebelum insert ke DOM
function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ✅ Pakai textContent, bukan innerHTML untuk data user
element.textContent = santri.nama;  // aman

// ❌ Hindari untuk data dari server
element.innerHTML = santri.nama;    // berbahaya jika ada script
```

#### Frontend RBAC (UI Only — bukan keamanan utama)

```javascript
// Frontend sembunyikan menu sesuai role
// TAPI backend tetap enforce — ini hanya UX
if (user.role !== 'pimpinan') {
  document.getElementById('menu-admin').classList.add('hidden');
}
```

#### Service Worker Security

```javascript
// sw.js — JANGAN cache endpoint yang berisi data sensitif
const NEVER_CACHE = [
  '/api/',         // semua API — data selalu fresh dari server
];

const CACHE_SAFE = [
  '/offline.html',
  '/manifest.json',
  '/icons/',
  '/assets/',      // CSS, JS (static files hasil build)
];
```

---

### 6.5 Keamanan Database

#### Hak Akses User PostgreSQL

```sql
-- App user: hanya bisa DML (bukan DDL)
CREATE USER mubtadiaat_user WITH PASSWORD 'password_kuat';
GRANT CONNECT ON DATABASE mubtadiaat TO mubtadiaat_user;
GRANT USAGE ON SCHEMA public TO mubtadiaat_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mubtadiaat_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mubtadiaat_user;

-- ❌ App TIDAK punya: CREATE TABLE, DROP, ALTER, TRUNCATE
-- Migration dijalankan dengan user superuser terpisah (saat deploy saja)
```

#### Koneksi Database

```
- PostgreSQL TIDAK expose port ke luar Docker network
- Hanya container go-app yang bisa akses db:5432
- Connection string dari .env (tidak hardcode)
- Connection pool: max 25 connections, idle timeout 5 menit
```

#### Data Sensitif di Database

```
- Password: bcrypt hash, TIDAK pernah simpan plaintext
- NIK santri: disimpan plaintext (perlu untuk pencarian)
  → akses dibatasi by RBAC (wali tidak bisa lihat NIK orang lain)
- Session ID: simpan hash di DB (bukan plaintext UUID)
```

---

### 6.6 Keamanan Infrastruktur (Docker + VPS)

#### Docker

```dockerfile
# Container berjalan sebagai non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Tidak ada secret di Dockerfile atau docker-compose.yml
# Semua dari .env file (tidak di-commit ke git)
```

```yaml
# docker-compose.yml
services:
  db:
    ports: []          # ❌ TIDAK expose ke host, hanya internal network
    networks:
      - internal

  app:
    ports:
      - "127.0.0.1:8080:8080"  # Hanya localhost, nginx yang akses
    networks:
      - internal

  nginx:
    ports:
      - "80:80"
      - "443:443"     # ✅ Hanya nginx yang expose ke internet
    networks:
      - internal

networks:
  internal:
    driver: bridge
```

#### Nginx HTTPS

```nginx
# Redirect semua HTTP → HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ...
}
```

#### VPS Hardening (Checklist Deploy)

```
[ ] SSH: disable password auth, pakai key only
[ ] SSH: ganti port default (bukan 22)
[ ] Firewall (ufw): hanya buka port 80, 443, SSH
[ ] Fail2ban: auto-block brute force SSH
[ ] Auto-update: unattended-upgrades aktif
[ ] .env: permission 600 (hanya owner yang bisa baca)
[ ] Git: .env ada di .gitignore
[ ] Docker: auto-restart on failure (restart: unless-stopped)
[ ] Backup: cron job backup PostgreSQL volume setiap hari
```

---

### 6.7 Audit Trail & Monitoring

#### Tabel `activity_log` — Apa yang Dicatat

| Action | Trigger | Detail yang Disimpan |
|---|---|---|
| `login` | Login berhasil | user_id, ip, timestamp |
| `failed_login` | Login gagal | username (string), ip, timestamp |
| `logout` | Logout | user_id, ip |
| `create` | INSERT data baru | target_table, target_id, data_baru (JSON) |
| `update` | UPDATE data | target_table, target_id, diff (JSON: before/after) |
| `delete` | DELETE data | target_table, target_id, data_lama (JSON) |
| `export` | Print rapot | target, filter yang dipakai |
| `bulk_action` | Naik kelas batch | daftar santri_id yang dipindah |

#### Retensi Log

```
activity_log disimpan permanen (tidak di-purge otomatis)
→ jika data terlalu besar: archive ke tabel activity_log_archive per tahun
```

---

### 6.8 Ringkasan Anti Data Leak

| Risiko | Mitigasi |
|---|---|
| Wali lihat nilai santri lain | Backend scope filter by `wali_santri_link` |
| Wali lihat data anak orang lain | Backend scope filter by `wali_santri_link` |
| Mustahiq akses bagian lain | Backend filter by `mustahiq_bagian` |
| Munawwib akses absensi bagian lain | Backend filter by `pengajar_bagian` WHERE `peran='munawwib'` |
| Munawwib lihat nilai detail | API strip nilai kuartal/khos dari response pencarian |
| Session dicuri (XSS) | Cookie HttpOnly, tidak bisa diakses JS |
| Session dicuri (CSRF) | SameSite=Strict + CSRF token |
| Brute force login | Rate limit + lockout sementara |
| SQL Injection | Prepared statements wajib |
| Data bocor via URL | Tidak ada data sensitif di query param |
| Foto santri diakses langsung | Serve via handler (bukan static URL) |
| Backup database bocor | Backup dienkripsi, akses terbatas |
| Secrets di kode | .env + .gitignore + env_file docker |
| Man-in-the-middle | HTTPS mandatory, HSTS header |

---

## 7. Role & Hak Akses

### Daftar Role

| Role | Kode | Deskripsi |
|---|---|---|
| **Pimpinan** | `pimpinan` | Mundzir / Dzurriyah / Server — akses penuh global |
| **Mufatish** | `mufatish` | Pimpinan Tingkatan — pantau semua bagian di tingkatannya (read-only) |
| **Mustahiq** | `mustahiq` | Wali Kelas — kelola data, nilai & absensi bagiannya, ikut naik kelas |
| **Munawwib** | `munawwib` | Asisten Wali Kelas — **hanya input absensi** bagian yang ditugaskan + lihat data umum via pencarian |
| **Admin** | `admin` | Akses penuh, setara Pimpinan — bisa kelola semua data, user, dan pengaturan |
| **Wali Santri** | `wali_santri` | Orang tua — login via NIK santri, lihat nilai & absensi anak sendiri |

### Matriks Hak Akses

> **Catatan:** `admin` diperlakukan setara `pimpinan` (akses penuh ke semua fitur). Bypass akses penuh untuk kedua role ini ditangani di `middleware/rbac.go`.

| Fitur | Pimpinan | Admin | Mufatish | Mustahiq | Munawwib | Wali Santri |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Data santri — dasar (nama, NIK, alamat, bagian) | ✅ Semua | ✅ Semua | ✅ Tingkatannya | ✅ Bagiannya | ✅ Bagiannya | ❌ |
| Data santri — nilai & absensi | ✅ Semua | ✅ Semua | ✅ Tingkatannya | ✅ Bagiannya | ❌ | ✅ Anaknya |
| Input nilai kuartal | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Input absensi perizinan | ✅ | ✅ | ❌ | ✅ Bagiannya | ✅ **Bagiannya saja** | ❌ |
| Kalkulasi & edit Nilai 'Am | ✅ | ✅ | ❌ | ✅ Bagiannya | ❌ | ❌ |
| Lihat rapot | ✅ Semua | ✅ Semua | ✅ Tingkatannya | ✅ Bagiannya | ❌ | ✅ Anaknya |
| Data alumni | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Data pengajar | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Data dewan harian | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pencarian global (data santri dasar) | ✅ | ✅ | ✅ | ✅ | ✅ **Dasar + Prestasi** | ❌ |
| Proses santri keluar (→ alumni) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Naik kelas (batch) + mustahiq | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manajemen akun user | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Kolom dinamis admin | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pengaturan aplikasi & rapot | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

> **Catatan Munawwib:**
> - Akses absensi dibatasi oleh `pengajar_bagian` WHERE `peran='munawwib'` AND `pengajar_id = users.pengajar_id`
> - Pencarian hanya menampilkan **nama, nomor stambuk, bagian, dan nilai Al-Bayan** (tidak tampilkan nilai kuartal/khos)
> - Munawwib **tidak bisa lihat detail rapot**, hanya data ringkasan dari hasil pencarian

---

## 8. Schema Database (ERD)

**Database:** PostgreSQL | **27 Tabel**

> **Perubahan dari draft awal:**
> - Tambah tabel `angkatan` (1 angkatan → banyak bagian A1, A2, ...)
> - `mata_pelajaran` FK ke `bagian` (bukan tingkatan) — dinamis per bagian
> - `santri` tambah field `nik` dan `nomor_stambuk`
> - **Semua santri keluar → alumni** (bukan hanya lulus). Status dibedakan lewat `status_keluar`
> - Login wali santri via NIK santri

```mermaid
erDiagram

    %% ══════════════════════════════════
    %% SISTEM & AKUN
    %% ══════════════════════════════════

    users {
        SERIAL      id PK
        VARCHAR     username UK
        VARCHAR     password_hash
        VARCHAR     role "pimpinan|admin|mufatish|mustahiq|munawwib|wali_santri"
        VARCHAR     nama
        INT         pengajar_id FK "nullable, link ke profil pengajar"
        BOOLEAN     is_password_changed "false = wajib ganti password"
        BOOLEAN     is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    sessions {
        UUID        id PK
        INT         user_id FK
        TIMESTAMPTZ expired_at
        TIMESTAMPTZ created_at
    }

    settings {
        SERIAL      id PK
        VARCHAR     key UK
        TEXT        value
        TEXT        keterangan
        TIMESTAMPTZ updated_at
    }

    rapot_settings {
        SERIAL      id PK
        TEXT        header_ar "Nama lembaga bahasa Arab"
        TEXT        subheader_ar "Sub judul bahasa Arab"
        TEXT        kepala_ar "Nama kepala bahasa Arab"
        TEXT        kota
        TEXT        logo_path
        TEXT        field_order "JSON urutan field rapot"
        TIMESTAMPTZ updated_at
    }

    activity_log {
        SERIAL      id PK
        INT         user_id FK
        VARCHAR     action "create|update|delete|login"
        VARCHAR     target
        INT         target_id
        JSONB       detail
        INET        ip_address
        TIMESTAMPTZ created_at
    }

    users ||--o{ sessions      : "punya"
    users ||--o{ activity_log  : "mencatat"

    %% ══════════════════════════════════
    %% STRUKTUR KELAS
    %% ══════════════════════════════════

    tingkatan {
        SERIAL      id PK
        VARCHAR     nama UK "Ibtidaiyyah|Tsanawiyyah|Aliyah"
        INT         urutan
        TIMESTAMPTZ created_at
    }

    angkatan {
        SERIAL      id PK
        VARCHAR     nama UK "2024/2025"
        INT         tahun_masuk "2024"
        BOOLEAN     is_active
        TIMESTAMPTZ created_at
    }

    bagian {
        SERIAL      id PK
        INT         angkatan_id FK
        INT         tingkatan_id FK
        VARCHAR     nama "A1|A2|B1"
        VARCHAR     tahun_ajaran "2024/2025"
        BOOLEAN     is_active
        TIMESTAMPTZ created_at
    }

    mustahiq_bagian {
        SERIAL      id PK
        INT         user_id FK "role=mustahiq"
        INT         bagian_id FK
        VARCHAR     tahun_ajaran
        TIMESTAMPTZ created_at
    }

    mufatish_tingkatan {
        SERIAL      id PK
        INT         user_id FK "role=mufatish"
        INT         tingkatan_id FK
        VARCHAR     tahun_ajaran
        TIMESTAMPTZ created_at
    }

    tingkatan  ||--o{ bagian             : "memiliki"
    angkatan   ||--o{ bagian             : "dipecah jadi"
    bagian     ||--o{ mustahiq_bagian    : "dipegang mustahiq"
    users      ||--o{ mustahiq_bagian    : "mustahiq"
    tingkatan  ||--o{ mufatish_tingkatan : "dipantau"
    users      ||--o{ mufatish_tingkatan : "mufatish"

    %% ══════════════════════════════════
    %% DATA SANTRI
    %% ══════════════════════════════════

    santri {
        SERIAL      id PK
        VARCHAR     nik UK "Nomor KTP santri, untuk login wali"
        VARCHAR     nomor_stambuk UK "NIS Pesantren"
        VARCHAR     nisn "dari pemerintah, opsional"
        VARCHAR     nama
        VARCHAR     nama_wali
        VARCHAR     ttl_tempat
        DATE        ttl_tanggal
        TEXT        alamat
        VARCHAR     no_hp
        TEXT        foto
        VARCHAR     tahun_masuk
        VARCHAR     tahun_keluar "diisi saat keluar"
        VARCHAR     status "aktif|cuti|boyong|lulus|keluar"
        JSONB       extra "kolom dinamis admin"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    wali_santri_link {
        SERIAL      id PK
        INT         user_id FK "role=wali_santri"
        INT         santri_id FK
        TIMESTAMPTZ created_at
    }

    users  ||--o{ wali_santri_link : "wali dari"
    santri ||--o{ wali_santri_link : "anaknya"

    %% ══════════════════════════════════
    %% RIWAYAT KELAS (PERPINDAHAN)
    %% ══════════════════════════════════

    riwayat_bagian {
        SERIAL      id PK
        INT         santri_id FK
        INT         bagian_id FK
        VARCHAR     tahun_ajaran
        DATE        tanggal_masuk
        DATE        tanggal_keluar "NULL = masih aktif"
        VARCHAR     tipe_perpindahan "naik_kelas|pindah_bagian|lulus|boyong|keluar|cuti|NULL"
        TEXT        keterangan
        INT         created_by FK
        TIMESTAMPTZ created_at
    }

    santri ||--o{ riwayat_bagian : "histori kelas"
    bagian ||--o{ riwayat_bagian : "diikuti"
    users  ||--o{ riwayat_bagian : "dicatat oleh"

    %% ══════════════════════════════════
    %% PROSES KELUAR → SEMUA JADI ALUMNI
    %% ══════════════════════════════════

    proses_keluar {
        SERIAL      id PK
        INT         santri_id FK
        VARCHAR     status_keluar "lulus|boyong|keluar"
        DATE        tanggal_proses
        VARCHAR     tahun_ajaran
        INT         bagian_terakhir_id FK
        TEXT        alasan "untuk boyong/keluar"
        TEXT        keterangan
        INT         processed_by FK
        TIMESTAMPTZ processed_at
    }

    alumni {
        SERIAL      id PK
        INT         santri_id FK "1:1 dengan santri"
        INT         proses_keluar_id FK
        VARCHAR     status_keluar "lulus|boyong|keluar"

        VARCHAR     status_khidmah "selesai_khidmah|tidak_khidmah|qodho_khidmah|NULL (hanya lulus)"
        TEXT        penempatan_khidmah
        TEXT        alasan_tidak_khidmah
        TEXT        keterangan_qodho_khidmah

        VARCHAR     status_ijazah "belum_diambil|sudah_diambil|tidak_bisa_diambil (hanya lulus)"
        DATE        tanggal_pengambilan_ijazah
        TEXT        keterangan_ijazah

        JSONB       extra
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    santri        ||--o| proses_keluar : "diproses keluar"
    bagian        ||--o{ proses_keluar : "bagian terakhir"
    users         ||--o{ proses_keluar : "diproses oleh"
    santri        ||--o| alumni        : "menjadi alumni"
    proses_keluar ||--o| alumni        : "memicu"

    %% ══════════════════════════════════
    %% PENGAJAR & DEWAN
    %% ══════════════════════════════════

    pengajar {
        SERIAL      id PK
        VARCHAR     nama
        VARCHAR     nama_wali
        VARCHAR     ttl_tempat
        DATE        ttl_tanggal
        TEXT        alamat
        VARCHAR     no_hp
        VARCHAR     tahun_mengajar
        VARCHAR     status "mustahiq|munawwib"
        BOOLEAN     is_active
        JSONB       extra
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    dewan_harian {
        SERIAL      id PK
        VARCHAR     nama
        VARCHAR     nama_wali
        VARCHAR     ttl_tempat
        DATE        ttl_tanggal
        TEXT        alamat
        VARCHAR     no_hp
        VARCHAR     jabatan
        VARCHAR     lembaga "P3HM|MPHM|M3PHM"
        VARCHAR     tahun_aktif
        BOOLEAN     is_active
        JSONB       extra
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    %% ══════════════════════════════════
    %% MATA PELAJARAN (per BAGIAN)
    %% ══════════════════════════════════

    mata_pelajaran {
        SERIAL      id PK
        INT         bagian_id FK "mapel unik per bagian"
        VARCHAR     nama
        VARCHAR     kategori "al_quran|akhlaq|khusus|umum"
        NUMERIC     nilai_max "8 untuk al_quran & akhlaq, 10 lainnya"
        BOOLEAN     masuk_jumlah "ikut kalkulasi Jumlah kuartal"
        BOOLEAN     masuk_am "ikut kalkulasi Nilai Am"
        INT         urutan
        BOOLEAN     is_active
        TIMESTAMPTZ created_at
    }

    bagian ||--o{ mata_pelajaran : "punya mapel sendiri"
    users  ||--o| pengajar       : "akun mustahiq link ke profil"

    %% ══════════════════════════════════
    %% NILAI KUARTAL (INPUT MENTAH)
    %% ══════════════════════════════════

    nilai_kuartal {
        SERIAL      id PK
        INT         santri_id FK
        INT         mata_pelajaran_id FK
        INT         bagian_id FK
        VARCHAR     tahun_ajaran
        SMALLINT    kuartal "1|2|3|4"
        NUMERIC     nilai "NULL=kosong, 7.5=7setengah"
        BOOLEAN     is_her "nilai dari Her Ujian, bisa diedit"
        INT         created_by FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    santri         ||--o{ nilai_kuartal : "punya nilai"
    mata_pelajaran ||--o{ nilai_kuartal : "dinilai"
    bagian         ||--o{ nilai_kuartal : "konteks kelas"
    users          ||--o{ nilai_kuartal : "diinput oleh"

    %% ══════════════════════════════════
    %% ABSENSI PERIZINAN
    %% ══════════════════════════════════

    absensi_perizinan {
        SERIAL      id PK
        INT         santri_id FK
        DATE        tanggal
        BOOLEAN     is_alpha "FALSE=bi_idzni(izin), TRUE=bi_ghoirihi(alpha)"
        TEXT        keterangan "opsional"
        INT         created_by FK
        TIMESTAMPTZ created_at
        "UNIQUE" santri_id_tanggal
    }

    rekap_absensi {
        SERIAL      id PK
        INT         santri_id FK
        VARCHAR     tahun_ajaran
        SMALLINT    kuartal "1|2|3|4"
        SMALLINT    jml_bi_idzni "diupdate saat input/hapus"
        SMALLINT    jml_bi_ghoirihi
        TIMESTAMPTZ updated_at
        "UNIQUE" santri_tahun_kuartal
    }

    kalender_kuartal {
        SERIAL      id PK
        VARCHAR     tahun_ajaran
        SMALLINT    kuartal "1|2|3|4"
        DATE        tanggal_mulai
        DATE        tanggal_selesai
        VARCHAR     keterangan "Tamrin Smt1 | Ujian Smt1 | Tamrin Smt2 | Ujian Smt2"
        "UNIQUE"    tahun_kuartal
    }

    pengajar_bagian {
        SERIAL      id PK
        INT         pengajar_id FK
        INT         bagian_id FK
        VARCHAR     peran "mustahiq|munawwib"
        VARCHAR     tahun_ajaran
        BOOLEAN     is_active
        TIMESTAMPTZ created_at
        "UNIQUE"    pengajar_bagian_tahun_peran
    }

    santri   ||--o{ absensi_perizinan : "punya absensi"
    santri   ||--o{ rekap_absensi     : "rekap per kuartal"
    users    ||--o{ absensi_perizinan : "diinput oleh"
    pengajar ||--o{ pengajar_bagian   : "ditugaskan ke"
    bagian   ||--o{ pengajar_bagian   : "punya pengajar"
    kalender_kuartal }|--|| bagian    : "berlaku untuk tahun ajaran"

    %% ══════════════════════════════════
    %% NILAI KHOS (KALKULASI SEMESTER)
    %% ══════════════════════════════════

    nilai_khos {
        SERIAL      id PK
        INT         santri_id FK
        INT         mata_pelajaran_id FK
        INT         bagian_id FK
        VARCHAR     tahun_ajaran
        SMALLINT    semester "1|2"
        NUMERIC     nilai_khos_raw "sebelum koreksi Akhlaq"
        SMALLINT    koreksi_akhlaq "0 atau -1, hanya mapel akhlaq"
        NUMERIC     nilai_khos_final "setelah koreksi, min 4 maks 9"
        BOOLEAN     is_belum_her "untuk Nilai Am: dihitung sbg 4"
        INT         calculated_by FK
        TIMESTAMPTZ calculated_at
    }

    santri         ||--o{ nilai_khos : "punya khos"
    mata_pelajaran ||--o{ nilai_khos : "per mapel"
    bagian         ||--o{ nilai_khos : "per kelas"
    users          ||--o{ nilai_khos : "dikalkulasi oleh"

    %% ══════════════════════════════════
    %% NILAI 'AM (RATA-RATA BAGIAN) — BISA DIEDIT
    %% ══════════════════════════════════

    nilai_am {
        SERIAL      id PK
        INT         bagian_id FK
        INT         mata_pelajaran_id FK
        VARCHAR     tahun_ajaran
        SMALLINT    semester "1|2"
        INT         jumlah_siswi
        INT         jumlah_belum_her "dihitung sbg nilai 4"
        NUMERIC     total_nilai
        NUMERIC     nilai_am_auto "hasil kalkulasi sistem"
        NUMERIC     nilai_am_final "bisa diedit manual, default = auto"
        BOOLEAN     is_edited "true jika sudah diedit manual"
        INT         calculated_by FK
        TIMESTAMPTZ calculated_at
    }

    bagian         ||--o{ nilai_am : "rata-rata kelas"
    mata_pelajaran ||--o{ nilai_am : "per mapel"
    users          ||--o{ nilai_am : "dikalkulasi oleh"

    %% ══════════════════════════════════
    %% NILAI BAYAN (PRESTASI TAHUNAN)
    %% ══════════════════════════════════

    nilai_bayan {
        SERIAL      id PK
        INT         santri_id FK
        INT         bagian_id FK
        VARCHAR     tahun_ajaran
        NUMERIC     total_nilai_khos
        INT         jumlah_mapel_x2
        NUMERIC     nilai_bayan_raw
        INT         total_bi_idzni
        INT         total_bi_ghoirihi
        SMALLINT    koreksi_bi_idzni "0 atau -1"
        SMALLINT    koreksi_bi_ghoirihi "0 atau -1"
        NUMERIC     nilai_bayan_final
        SMALLINT    nilai_bayan_bulat "5|6|7|8|9"
        VARCHAR     label_bayan "al-Jayyid al-Awwal dst"
        INT         calculated_by FK
        TIMESTAMPTZ calculated_at
    }

    santri ||--o| nilai_bayan : "punya bayan"
    bagian ||--o{ nilai_bayan : "per angkatan"
    users  ||--o{ nilai_bayan : "dikalkulasi oleh"

    %% ══════════════════════════════════
    %% KOLOM DINAMIS ADMIN
    %% ══════════════════════════════════

    dynamic_columns {
        SERIAL      id PK
        VARCHAR     target_table "santri|alumni|pengajar|dewan_harian"
        VARCHAR     column_key
        VARCHAR     column_label
        VARCHAR     column_type "text|number|date|select|textarea"
        JSONB       select_options
        BOOLEAN     is_required
        INT         urutan
        BOOLEAN     is_active
        TIMESTAMPTZ created_at
    }
```

### Ringkasan 24 Tabel

| # | Tabel | Keterangan |
|---|---|---|
| 1 | `users` | Akun + 6 role |
| 2 | `sessions` | Session login |
| 3 | `settings` | Konfigurasi app |
| 4 | `rapot_settings` | Header rapot custom (bahasa Arab) |
| 5 | `activity_log` | Audit trail |
| 6 | `tingkatan` | Level: Ibtidaiyyah, Tsanawiyyah, Aliyah |
| 7 | **`angkatan`** | **Cohort/angkatan per tahun** |
| 8 | `bagian` | Kelas konkret (A1, A2) per angkatan per tingkatan |
| 9 | `mustahiq_bagian` | Relasi mustahiq ↔ bagian (naik kelas ikut siswi) |
| 10 | `mufatish_tingkatan` | Relasi mufatish ↔ tingkatan |
| 11 | `santri` | Data santri (+ NIK + Nomor Stambuk) |
| 12 | `wali_santri_link` | Relasi akun wali ↔ anak (login via NIK santri) |
| 13 | `riwayat_bagian` | Histori perpindahan kelas |
| 14 | **`proses_keluar`** | **Event keluar: lulus / boyong / keluar** |
| 15 | **`alumni`** | **Semua santri keluar → alumni** (status_keluar membedakan) |
| 16 | `pengajar` | Data mustahiq & munawwib (profil & historis) |
| 17 | **`pengajar_bagian`** | **Penugasan mustahiq/munawwib ke bagian per tahun ajaran** |
| 18 | `dewan_harian` | P3HM / MPHM / M3PHM |
| 19 | `mata_pelajaran` | Mapel **per bagian** (dinamis, berbeda tiap bagian) |
| 20 | `nilai_kuartal` | Nilai K1–K4 mentah (is_her = terpisah, bisa diedit) |
| 21 | `absensi_perizinan` | Bi Idzni (izin+sakit) & Bi Ghoirihi (alpha) — hanya yang tidak hadir |
| 22 | **`rekap_absensi`** | **Ringkasan per kuartal** (jml izin & alpha, update otomatis) |
| 23 | **`kalender_kuartal`** | **Tanggal mulai-selesai tiap kuartal per tahun ajaran** |
| 24 | `nilai_khos` | Kalkulasi nilai semester + koreksi akhlaq |
| 25 | `nilai_am` | Rata-rata bagian per mapel (otomatis + bisa diedit) |
| 26 | `nilai_bayan` | Prestasi tahunan + Al-Bayan |
| 27 | `dynamic_columns` | Kolom dinamis admin |

---

## 9. Alur Perpindahan Kelas & Kelulusan

---

### 7.0 Setup Kelas Baru & Assignment Santri

> **Jawaban:** Ya — nama bagian **bebas dikustom** (tidak harus A1/A2), dan santri di-assign **manual** oleh admin ke bagian manapun.

#### Nama Bagian Bebas

```
Bagian tidak harus bernama "A1", "A2".
Admin bisa beri nama apapun saat membuat bagian:

Contoh nama bagian yang valid:
  - A1, A2, B1 (nama standar)
  - Fathul Muin, Saniyyah, Tsalitsah (nama kitab)
  - Pagi, Siang (jika ada shift)
  - 2024-A, 2024-B (kode custom)

Field yang diisi saat buat bagian baru:
  - Nama bagian   : bebas (VARCHAR)
  - Tingkatan     : Ibtidaiyyah / Tsanawiyyah / Aliyah (pilih dari daftar)
  - Angkatan      : pilih dari daftar angkatan (atau buat baru)
  - Tahun ajaran  : otomatis dari angkatan, bisa di-override
```

#### Skenario 1 — Setup Awal Sistem (Data Existing)

Dipakai saat sistem pertama kali dijalankan dan madrasah sudah punya santri aktif.

```
LANGKAH 1 — Admin buat Tingkatan
  - Ibtidaiyyah (urutan 1)
  - Tsanawiyyah (urutan 2)
  - Aliyah      (urutan 3)

LANGKAH 2 — Admin buat Angkatan
  - Misal: 2024/2025 (tahun ajaran berjalan)

LANGKAH 3 — Admin buat Bagian
  - Nama: bebas (misal "A1"), pilih Tingkatan + Angkatan
  - Ulangi untuk setiap kelas yang ada (A1 Ibtidaiyyah, A2 Ibtidaiyyah, dst.)

LANGKAH 4 — Admin input Santri (atau import)
  - Input satu per satu via form
  - Atau import CSV (jika fitur tersedia)
  - Isi: NIK, Nomor Stambuk, Nama, dll.
  - Status: 'aktif'

LANGKAH 5 — Admin assign Santri ke Bagian
  - Buka halaman "Assignment Awal Santri"
  - Sistem tampilkan daftar santri yang BELUM punya bagian aktif
  - Admin centang santri → pilih bagian → Simpan
  - Sistem INSERT riwayat_bagian (tipe_perpindahan = NULL, tanggal_keluar = NULL)

  Tampilan UI:
  ┌─────────────────────────────────────────────────────┐
  │ Santri Belum Dikelas   Filter: [Semua ▼]            │
  ├──┬──────────────────┬────────────┬──────────────────┤
  │☑ │ Nama             │ Stambuk    │ Assign ke Bagian │
  ├──┼──────────────────┼────────────┼──────────────────┤
  │☑ │ Aisyah           │ 24001      │ [A1 Ibti.. ▼]   │
  │☑ │ Fatimah          │ 24002      │ [A1 Ibti.. ▼]   │
  │☑ │ Khadijah         │ 24003      │ [A2 Ibti.. ▼]   │
  │☐ │ Maryam           │ 24004      │ [A1 Ibti.. ▼]   │
  └──┴──────────────────┴────────────┴──────────────────┘
  [Simpan Assignment]
```

#### Skenario 2 — Santri Baru Masuk (Tahun Ajaran Berjalan)

Dipakai saat ada santri baru mendaftar di tengah atau awal tahun ajaran.

```
LANGKAH 1 — Admin input data santri baru
  - Isi form: NIK, Nomor Stambuk, Nama, Wali, TTL, Alamat, HP, dll.
  - Tahun masuk: otomatis tahun ajaran berjalan
  - Status: 'aktif'

LANGKAH 2 — Langsung assign ke bagian
  - Di form input santri, ada field "Bagian" (dropdown)
  - Admin pilih bagian yang dituju
  - Saat simpan → sistem otomatis INSERT riwayat_bagian
  - Mustahiq bagian tersebut bisa langsung lihat santri baru di daftarnya

  ATAU biarkan bagian kosong dulu → assign nanti via halaman "Santri Belum Dikelas"
```

#### Skenario 3 — Buka Kelas Baru di Tahun Ajaran Baru

Dipakai saat awal tahun ajaran baru, kelas-kelas baru perlu dibuat.

```
LANGKAH 1 — Admin buat Angkatan baru
  - Misal: 2025/2026

LANGKAH 2 — Admin buat Bagian baru untuk angkatan ini
  - A1 Ibtidaiyyah (2025/2026)
  - A2 Ibtidaiyyah (2025/2026)
  - dll.

LANGKAH 3 — Santri lama naik kelas → pakai proses Naik Kelas (7.2)
LANGKAH 4 — Santri baru → pakai Skenario 2 di atas

CATATAN:
  Bagian lama (2024/2025) otomatis "tidak aktif" setelah semua santrinya
  pindah. Admin bisa set is_active = false secara manual juga.
```

#### Aturan Sistem

| Kondisi | Aturan |
|---|---|
| Nama bagian | Bebas, tidak ada validasi format khusus |
| Santri belum punya bagian | Tampil di daftar "Belum Dikelas", tidak muncul di halaman harian |
| Satu santri satu bagian | Selalu — tidak bisa assign ke 2 bagian sekaligus |
| Bagian kosong (0 santri) | Tetap ada di sistem, bisa dihapus jika belum ada data nilai |
| Mustahiq per bagian | Diassign terpisah di menu Admin → Penugasan Mustahiq |

---



### 7.1 Pola Utama: `riwayat_bagian`

Setiap santri punya **satu baris aktif** (`tanggal_keluar = NULL`).
Saat perpindahan → baris lama **ditutup**, baris baru **dibuat**.

```
[Santri Masuk Pertama Kali]
        │  INSERT riwayat_bagian (tanggal_keluar=NULL, tipe=NULL)
        ▼
  AKTIF di bagian (A1 Ibtidaiyyah 2024/2025)
        │
        ├─── NAIK KELAS (lihat 7.2 — dengan redistribusi bagian)
        │
        ├─── PINDAH BAGIAN (level sama, individual)
        │     UPDATE riwayat_bagian lama (tipe='pindah_bagian')
        │     INSERT baris baru (bagian tujuan)
        │
        ├─── CUTI SEMENTARA
        │     UPDATE riwayat_bagian (tipe='cuti')
        │     UPDATE santri.status = 'cuti'
        │     [Saat kembali → INSERT riwayat_bagian baru, status='aktif']
        │
        └─── KELUAR (lulus / boyong / dropout)
              ─ SEMUA TIPE JADI ALUMNI ─
              1. INSERT proses_keluar (status_keluar = 'lulus'|'boyong'|'keluar')
              2. UPDATE riwayat_bagian (tanggal_keluar=hari_ini, tipe=status_keluar)
              3. UPDATE santri.status = status_keluar, tahun_keluar = tahun
              4. INSERT alumni:
                  - lulus   → isi kolom khidmah & ijazah (bisa diupdate later)
                  - boyong  → kolom khidmah/ijazah NULL, isi alasan
                  - keluar  → kolom khidmah/ijazah NULL, isi alasan
```

---

### 7.2 Naik Kelas dengan Redistribusi Bagian

> **Kasus:** Saat naik kelas dari Ibtidaiyyah ke Tsanawiyyah, santri dari A1 Ibtidaiyyah **tidak semua** masuk A1 Tsanawiyyah.
> Sebagian bisa dipindah ke A2 Tsanawiyyah (redistribusi). Ini diatur admin per individu santri.

#### Alur Proses Naik Kelas (UI)

```
LANGKAH 1 — Admin buka halaman "Naik Kelas"
  Admin pilih:
    - Bagian Asal     : A1 Ibtidaiyyah (2024/2025)
    - Tingkatan Tujuan: Tsanawiyyah (2025/2026)
  Klik "Mulai Proses Naik Kelas"

LANGKAH 2 — Sistem tampilkan tabel assignment:
  ┌──────────────────────────────────────────────────────┐
  │  No │ Nama Santri   │ NIS       │ Bagian Tujuan     │
  ├──────────────────────────────────────────────────────┤
  │  1  │ Aisyah        │ 24001     │ [A1 Tsanawiyyah ▼]    │
  │  2  │ Fatimah       │ 24002     │ [A1 Tsanawiyyah ▼]    │
  │  3  │ Khadijah      │ 24003     │ [A2 Tsanawiyyah ▼] ←admin ganti
  │  4  │ Maryam        │ 24004     │ [A2 Tsanawiyyah ▼] ←admin ganti
  │  5  │ Zainab        │ 24005     │ [A1 Tsanawiyyah ▼]    │
  └──────────────────────────────────────────────────────┘
  Dropdown "Bagian Tujuan" berisi semua bagian aktif di tingkatan tujuan.
  Default: bagian dengan nama sama (A1 → A1), bisa diubah per baris.

LANGKAH 3 — Admin review:
  Ringkasan:
    A1 Tsanawiyyah ← 3 santri (Aisyah, Fatimah, Zainab)
    A2 Tsanawiyyah ← 2 santri (Khadijah, Maryam)

  Mustahiq A1 Ibtidaiyyah saat ini: Ustadzah Halimah
  [Ikut ke bagian mana?] → [A1 Tsanawiyyah ▼]
  (admin pilih, default: mayoritas santri pergi ke mana)

LANGKAH 4 — Klik "Konfirmasi & Eksekusi"
  Sistem jalankan 1 transaksi database.
```

#### Transaksi Database (1 kali, atomic)

```sql
BEGIN;

-- Untuk setiap santri (diulang per baris assignment):

-- 1. Tutup riwayat lama
UPDATE riwayat_bagian
SET tanggal_keluar = CURRENT_DATE, tipe_perpindahan = 'naik_kelas'
WHERE santri_id = $santri_id AND tanggal_keluar IS NULL;

-- 2. Buat riwayat baru (bagian_tujuan bisa beda per santri)
INSERT INTO riwayat_bagian
  (santri_id, bagian_id, tahun_ajaran, tanggal_masuk, tipe_perpindahan, created_by)
VALUES
  ($santri_id, $bagian_tujuan_id, '2025/2026', CURRENT_DATE, NULL, $user_id);

-- 3. Update mustahiq (sesuai pilihan admin)
UPDATE mustahiq_bagian
SET bagian_id = $bagian_tujuan_mustahiq_id, tahun_ajaran = '2025/2026'
WHERE user_id = $mustahiq_user_id AND bagian_id = $bagian_asal_id;

COMMIT;
-- Jika ada error di mana pun → ROLLBACK semua
```

#### Aturan Redistribusi

| Kondisi | Aturan |
|---|---|
| Santri pindah ke bagian sama (A1→A1) | `tipe_perpindahan = 'naik_kelas'` |
| Santri pindah ke bagian beda (A1→A2) | `tipe_perpindahan = 'naik_kelas'` (sama, dibedakan dari `bagian_id` tujuannya) |
| Mustahiq | Admin wajib pilih bagian tujuan mustahiq. Jika ada 2 mustahiq, masing-masing assign sendiri |
| Santri yang tidak naik (cuti, tunda) | Jangan dimasukkan ke tabel assignment. Proses cuti terpisah |
| Bagian tujuan belum ada | Admin harus buat bagian tujuan dulu di menu Admin → Bagian |

#### Bagaimana Histori Terbaca?

```
Contoh histori santri Khadijah (dari A1 Ibtidaiyyah → A2 Tsanawiyyah):

riwayat_bagian:
  id | santri_id | bagian_id       | tipe_perpindahan | tgl_masuk  | tgl_keluar
   1 | 123       | A1 Ibtidaiyyah (id=5)   | NULL             | 2024-07-01 | 2025-06-30
   2 | 123       | A2 Tsanawiyyah (id=8)| naik_kelas       | 2025-07-01 | NULL ← aktif

Terbaca: "Masuk A1 Ibtidaiyyah, naik kelas ke A2 Tsanawiyyah"
```

---

### 7.3 Perbedaan Status Alumni

| Status Keluar | Kolom Khidmah | Kolom Ijazah | Field Khusus |
|---|:---:|:---:|---|
| `lulus` | ✅ Ada | ✅ Ada | penempatan_khidmah, status_ijazah |
| `boyong` | ❌ NULL | ❌ NULL | alasan (di proses_keluar) |
| `keluar` | ❌ NULL | ❌ NULL | alasan (di proses_keluar) |

---

### 7.4 Login Wali Santri via NIK

```
Wali buka halaman login
  → Masukkan NIK santri (Nomor KTP anak)
  → Sistem cari santri.nik
  → Cek ada di wali_santri_link
  → Jika cocok → login sebagai wali_santri
  → Tampilkan hanya data anak tersebut
```

---

## 10. Desain Penyimpanan Absensi

> **Filosofi:** Simpan detail seminimal mungkin, kalkulasi seringan mungkin.

---

### 8.1 Masalah Desain Lama

| Kolom Lama | Masalah |
|---|---|
| `VARCHAR tipe` | Boros vs BOOLEAN. `'bi_idzni'` = 9 bytes, BOOLEAN = 1 byte |
| `SMALLINT semester` | Redundan — bisa dihitung dari `tanggal` |
| `VARCHAR tahun_ajaran` | Redundan — bisa dihitung dari `tanggal` |
| Tidak ada UNIQUE | Satu santri bisa punya 2 record di hari yang sama |
| Tidak ada rekap | Setiap hitung rapot = full table scan semua row |

---

### 8.2 Desain Baru: 2 Tabel

```
absensi_perizinan          rekap_absensi
─────────────────          ──────────────────────────────
id         SERIAL PK       id         SERIAL PK
santri_id  INT FK     ─┐   santri_id  INT FK
tanggal    DATE        │   tahun_ajaran VARCHAR(9)
is_alpha   BOOLEAN     │   kuartal    SMALLINT  ← 1|2|3|4
keterangan TEXT        │   jml_bi_idzni    SMALLINT
created_by INT FK      │   jml_bi_ghoirihi SMALLINT
created_at TIMESTAMPTZ └─► updated_at TIMESTAMPTZ
                           UNIQUE(santri_id, tahun_ajaran, kuartal)
UNIQUE(santri_id, tanggal)
INDEX(santri_id, tanggal)
```

#### `absensi_perizinan` — Detail Harian

```sql
CREATE TABLE absensi_perizinan (
    id          SERIAL PRIMARY KEY,
    santri_id   INT NOT NULL REFERENCES santri(id),
    tanggal     DATE NOT NULL,
    is_alpha    BOOLEAN NOT NULL DEFAULT false,
    -- FALSE = bi idzni (izin termasuk sakit)
    -- TRUE  = bi ghoirihi (alpha)
    keterangan  TEXT,
    created_by  INT REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_absensi_santri_hari UNIQUE (santri_id, tanggal)
);

CREATE INDEX idx_absensi_santri_tgl ON absensi_perizinan (santri_id, tanggal);
```

**Kenapa hapus `semester`/`kuartal`/`tahun_ajaran` dari tabel detail?**
```
Kuartal dan tahun ajaran DIHITUNG dari kolom tanggal
menggunakan tabel kalender_kuartal — dikonfigurasi admin per tahun:

kalender_kuartal (2024/2025):
  K1: 2024-07-01 s/d 2024-09-30  ← Tamrin Smt1
  K2: 2024-10-01 s/d 2024-12-31  ← Ujian Smt1
  K3: 2025-01-01 s/d 2025-03-31  ← Tamrin Smt2
  K4: 2025-04-01 s/d 2025-06-30  ← Ujian Smt2

Tanggal-tanggal ini BERBEDA tiap tahun → admin set sendiri.
Tidak ada asumsi hardcode di kode.
```

#### `kalender_kuartal` — Konfigurasi Admin

```sql
CREATE TABLE kalender_kuartal (
    id              SERIAL PRIMARY KEY,
    tahun_ajaran    VARCHAR(9) NOT NULL,   -- '2024/2025'
    kuartal         SMALLINT NOT NULL,     -- 1, 2, 3, 4
    tanggal_mulai   DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    keterangan      VARCHAR(50),
    -- 'Tamrin Smt1' | 'Ujian Smt1' | 'Tamrin Smt2' | 'Ujian Smt2'

    CONSTRAINT uq_kalender_tahun_k UNIQUE (tahun_ajaran, kuartal)
);
```

> Admin buka **Menu Admin → Kalender Kuartal** → set tanggal mulai & selesai
> untuk setiap kuartal di tahun ajaran baru.

#### `rekap_absensi` — Summary per Kuartal

```sql
CREATE TABLE rekap_absensi (
    id               SERIAL PRIMARY KEY,
    santri_id        INT NOT NULL REFERENCES santri(id),
    tahun_ajaran     VARCHAR(9) NOT NULL,
    kuartal          SMALLINT NOT NULL,    -- 1, 2, 3, 4
    jml_bi_idzni     SMALLINT NOT NULL DEFAULT 0,
    jml_bi_ghoirihi  SMALLINT NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_rekap_santri_kuartal UNIQUE (santri_id, tahun_ajaran, kuartal)
);
```

**Diupdate kapan?**
```
Saat INPUT absensi tanggal T:
  1. Tentukan kuartal K dari tanggal T (lookup kalender_kuartal)
  2. UPSERT rekap_absensi: INCREMENT jml_bi_idzni ATAU jml_bi_ghoirihi

Saat HAPUS absensi:
  1. Tentukan kuartal dari tanggal record yang dihapus
  2. DECREMENT rekap_absensi (tidak boleh < 0)

Saat EDIT tipe (izin → alpha atau sebaliknya):
  1. Decrement lama, increment baru — dalam 1 transaksi

Dilakukan di Go, BUKAN trigger database — lebih mudah test & debug.
```

---

### 8.3 Alur Input Absensi (UI)

```
Mustahiq/Pimpinan buka halaman "Input Absensi"
  Pilih: Bagian + Tanggal

Sistem tampilkan grid:
  ┌───────────────────────────────────────────────────────┐
  │ Absensi — A1 Ibtidaiyyah — Senin, 14 Juli 2025       │
  │ Kuartal 1 (Tamrin Smt1)  2024/2025                   │
  ├────┬──────────────────┬──────────┬────────────────────┤
  │ No │ Nama             │ Status   │ Keterangan         │
  ├────┼──────────────────┼──────────┼────────────────────┤
  │  1 │ Aisyah           │ [Hadir▼] │                    │
  │  2 │ Fatimah          │ [Izin ▼] │ [Sakit demam     ] │
  │  3 │ Khadijah         │ [Alpha▼] │                    │
  │  4 │ Maryam           │ [Hadir▼] │                    │
  └────┴──────────────────┴──────────┴────────────────────┘
  [Simpan]

Status dropdown:
  - Hadir  → tidak disimpan (tidak ada row = hadir)
  - Izin   → INSERT is_alpha=false
  - Alpha  → INSERT is_alpha=true

Info kuartal ditampilkan otomatis dari kalender_kuartal.
```

> **Efisiensi:** Hanya santri yang **tidak hadir** yang punya row di database.
> Hadir = tidak ada record. Storage sangat hemat.

---

### 8.4 Kalkulasi Koreksi Nilai (pakai `rekap_absensi`)

```go
// Di Go — saat hitung Nilai Khos / Prestasi Al-Bayan
// Cukup query rekap_absensi — O(1) per santri

// ── Koreksi KHOS Semester 1 (pakai rekap K1 + K2) ──
rows := db.Query(`
    SELECT COALESCE(SUM(jml_bi_idzni),0), COALESCE(SUM(jml_bi_ghoirihi),0)
    FROM rekap_absensi
    WHERE santri_id = $1 AND tahun_ajaran = $2 AND kuartal IN (1, 2)
`, santriID, tahunAjaran)
// bi_idzni_smt1 >= 20 → koreksi -= 1
// bi_ghoirihi_smt1 >= 6 → koreksi -= 1

// ── Koreksi KHOS Semester 2 (pakai rekap K3 + K4) ──
rows := db.Query(`
    SELECT COALESCE(SUM(jml_bi_idzni),0), COALESCE(SUM(jml_bi_ghoirihi),0)
    FROM rekap_absensi
    WHERE santri_id = $1 AND tahun_ajaran = $2 AND kuartal IN (3, 4)
`, santriID, tahunAjaran)
// bi_idzni_smt2 >= 20 → koreksi -= 1
// bi_ghoirihi_smt2 >= 6 → koreksi -= 1

// ── Koreksi AL-BAYAN (gabung semua 4 kuartal) ──
rows := db.Query(`
    SELECT COALESCE(SUM(jml_bi_idzni),0), COALESCE(SUM(jml_bi_ghoirihi),0)
    FROM rekap_absensi
    WHERE santri_id = $1 AND tahun_ajaran = $2
`, santriID, tahunAjaran)
// bi_idzni_total >= 15 → koreksi -= 1
// bi_ghoirihi_total >= 5 → koreksi -= 1
```

---

### 8.5 Perbandingan Storage

| Desain | Row per Santri/Tahun | Bytes per Row | Total (500 santri) |
|---|:---:|:---:|:---:|
| **Lama** (per hari, VARCHAR) | ~30 absen/th | ~80 bytes | ~1.2 MB/tahun |
| **Baru** (per hari, BOOLEAN) | ~30 absen/th | ~45 bytes | **~675 KB/tahun** |
| **Rekap** (per kuartal) | 4 row/th | ~35 bytes | **~70 KB/tahun** |

> Penghematan ~44% storage detail + kalkulasi nilai **O(1)** (2–3 query ringan vs full scan).

---

### 8.6 Rekap Pengajar — Mustahiq & Munawwib

#### Tabel `pengajar_bagian`

```sql
CREATE TABLE pengajar_bagian (
    id           SERIAL PRIMARY KEY,
    pengajar_id  INT NOT NULL REFERENCES pengajar(id),
    bagian_id    INT NOT NULL REFERENCES bagian(id),
    peran        VARCHAR(10) NOT NULL,  -- 'mustahiq' | 'munawwib'
    tahun_ajaran VARCHAR(9) NOT NULL,
    is_active    BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_pgj_bagian_tahun_peran
        UNIQUE (pengajar_id, bagian_id, tahun_ajaran, peran)
);
```

#### Contoh Data Rekap

```
Tahun Ajaran: 2024/2025

Bagian        │ Mustahiq          │ Munawwib
──────────────┼───────────────────┼──────────────────
A1 Ibti.      │ Ustadzah Halimah  │ Ustadzah Aisyah
A2 Ibti.      │ Ustadzah Maryam   │ (kosong)
A1 Tsanawiyah │ Ustadzah Khadijah │ Ustadzah Fatimah
A1 Aliyah     │ Ustadzah Zainab   │ Ustadzah Ruqoyyah
```

#### Fitur Rekap di Aplikasi

```
Menu: Pengajar → Rekap Penugasan

Filter: Tahun Ajaran [2024/2025 ▼]

Tampilan:
  - Tabel: Nama | Peran | Bagian | Tingkatan | Tahun Aktif
  - Filter per peran (mustahiq / munawwib)
  - Filter per tingkatan
  - Bisa print / export

Detail pengajar:
  - Profil lengkap (nama, TTL, alamat, HP, wali)
  - Riwayat penugasan: pernah jadi mustahiq/munawwib di bagian mana saja
    (historis lintas tahun ajaran)
```

#### Perbedaan `mustahiq_bagian` vs `pengajar_bagian`

| Tabel | FK Utama | Fungsi |
|---|---|---|
| `mustahiq_bagian` | `users.id` | **Akses kontrol** — user login dengan role mustahiq bisa lihat bagian mana |
| `pengajar_bagian` | `pengajar.id` | **Data rekap** — profil & riwayat penugasan mustahiq/munawwib |

> Seorang mustahiq punya **2 record**: satu di `users` (akun login) + satu di `pengajar` (data profil).
> Keduanya dihubungkan via kolom `users.pengajar_id` (FK opsional, bisa NULL untuk role lain).

---


## 11. Logika Penilaian


### A. Kategori Mata Pelajaran

| Kategori | Contoh | Nilai Maks | Masuk Jumlah Kuartal | Masuk Nilai 'Am | Koreksi Akhlaq |
|---|---|:---:|:---:|:---:|:---:|
| `al_quran` | Al-Qur'an | 8 | ❌ | ✅ | ❌ |
| `akhlaq` | Akhlaq | 8 | ❌ | ✅ | ✅ |
| `khusus` | Al-Khot/Imla', Qiroah al-Kutub, Al-Muhafadhoh | 10 | ❌ | ✅ | ❌ |
| `umum` | Semua mapel lainnya | 10 | ✅ | ✅ | ❌ |

> **Input nilai:** Disimpan sebagai desimal. `7.5` tampil sebagai `7½`. NULL = tidak ada nilai.

### B. Nilai Kuartal

```
INPUT per siswi per mapel per kuartal:
  nilai: 0 – nilai_max (float, mendukung 0.5)
  NULL = tidak hadir / tidak ada nilai

KALKULASI OTOMATIS:
  Jumlah   = Σ nilai (hanya mapel kategori 'umum')
  Rata-rata = Jumlah ÷ jumlah_mapel_umum

HER UJIAN:
  - Dicatat dengan is_her = TRUE (terpisah dari nilai asli)
  - Nilai Her bisa diedit
  - Sistem menggunakan nilai Her untuk kalkulasi Khos
```

### C. Nilai Khos Semester 1

```
INPUT: Kuartal 1 (tamrin) + Kuartal 2 (ujian)

RUMUS:
  Jika K1 ADA    → Khos_raw = (K1 + K2) / 2
  Jika K1 KOSONG → Khos_raw = K2 / 2  ← siswi tanpa tamrin

PEMBULATAN (aturan pesantren):
  Sisa < 0.5  → bulatkan ke bawah
  Sisa ≥ 0.5  → bulatkan ke atas

RENTANG: min 4, maks 9

KOREKSI AKHLAQ (hanya mapel 'akhlaq'):
  Bi Idzni    ≥ 20 hari dalam smt 1 → koreksi -1
  Bi Ghoirihi ≥  6 hari dalam smt 1 → koreksi -1
  Khos_final = max(Khos_raw + koreksi, 4)
```

### D. Nilai Khos Semester 2

```
INPUT: Kuartal 3 (tamrin) + Kuartal 4 (ujian)

  Jika K3 ADA    → Khos_raw = (K3 + K4) / 2
  Jika K3 KOSONG → Khos_raw = K4 / 2

(Pembulatan, rentang, koreksi Akhlaq: sama dengan Smt 1)
```

### E. Nilai 'Am (Rata-rata Bagian)

```
DIHITUNG OTOMATIS, bisa diedit manual:

  nilai_am_auto = Σ nilai_khos_final seluruh siswi ÷ jumlah_siswi

ATURAN:
  Siswi belum Her Ujian → dihitung dengan nilai 4 (tidak di-skip)
  Jika admin edit manual → nilai_am_final = nilai_am_manual, is_edited = true
```

### F. Al-Bayan / Nilai Prestasi Tahunan

```
RUMUS:
  Al-Bayan_raw = Σ (khos_final smt1 + smt2, SEMUA mapel)
                 ÷ (jumlah_mapel × 2)

KOREKSI PRESTASI (total smt1 + smt2):
  Bi Idzni    ≥ 15 hari/tahun → -1 nilai prestasi
  Bi Ghoirihi ≥  5 hari/tahun → -1 nilai prestasi

PEMBULATAN: sama dengan aturan Khos (≥ 0.5 ke atas)

KATEGORI:
  9 → الجيد الأول    (Al-Jayyid Al-Awwal)
  8 → الجيد الثاني   (Al-Jayyid Ats-Tsani)
  7 → المتوسط الأول  (Al-Mutawassith Al-Awwal)
  6 → المتوسط الثاني (Al-Mutawassith Ats-Tsani)
  5 → الردي          (Ar-Raddi)
```

### G. Alur Kalkulasi

```
nilai_kuartal (K1–K4) ──┐
absensi_perizinan ────────┼──► nilai_khos (per smt) ──► nilai_bayan (Al-Bayan)
Her Ujian (is_her) ───────┘  + koreksi akhlaq           + koreksi prestasi tahunan
                              ↓
                           nilai_am (otomatis, bisa diedit)
```

---

## 12. Fitur-Fitur Aplikasi

### Data Santri
- CRUD lengkap: **NIK** (KTP), **Nomor Stambuk** (NIS Pesantren), NISN, Nama, Wali, TTL, Alamat, HP, Foto
- Status: `aktif` | `cuti` | `boyong` | `lulus` | `keluar`
- Data **tidak pernah dihapus** — hanya status yang berubah
- Halaman harian: hanya tampil santri aktif
- Menu arsip/database: tampil semua termasuk boyong/lulus/keluar

### Data Alumni (SEMUA santri keluar)
- Dibuat **otomatis** saat santri diproses keluar
- `status_keluar`: `lulus` | `boyong` | `keluar`
- Khusus lulus: update kolom khidmah & ijazah bisa dilakukan kapan saja
- Boyong/keluar: hanya ada alasan di `proses_keluar`
- Filter alumni: per status_keluar, per tahun, per bagian terakhir

### Naik Kelas (Batch + Mustahiq Ikut)
- Admin pilih bagian asal → bagian tujuan
- Sistem tampilkan daftar siswi + mustahiq yang akan pindah
- Admin konfirmasi → semua berpindah sekaligus (1 transaksi)
- `riwayat_bagian` terupdate untuk siswi dan `mustahiq_bagian` terupdate untuk mustahiq

### Mata Pelajaran Dinamis per Bagian
- Setiap bagian bisa punya mapel berbeda
- Admin bisa tambah/edit/hapus mapel per bagian
- Naik kelas = bagian baru, mapel baru dibuat ulang (tidak dikopi otomatis)

### Nilai Kuartal
- Grid input per bagian: baris = siswi, kolom = mapel
- Nilai ½ didukung (input 7.5 tampil 7½)
- Her Ujian dicatat terpisah (`is_her = true`), bisa diedit
- Kalkulasi Jumlah & Rata-rata otomatis

### Absensi Perizinan
- **Bi Idzni** = izin (termasuk sakit, keperluan apapun)
- **Bi Ghoirihi** = alpha (tidak hadir tanpa keterangan)
- Input per hari, per siswi
- Rekap otomatis per semester & tahunan

### Nilai 'Am & Al-Bayan
- Dihitung otomatis setelah semua Nilai Khos diinput
- Nilai 'Am bisa diedit manual (sistem simpan flag `is_edited`)
- Al-Bayan final = prestasi tahunan dengan label Arabic

### Rapot
- Tampil di layar, bisa cetak via browser (Ctrl+P)
- **Header full custom**: nama lembaga, sub-header, kepala — semua dalam bahasa Arab
- Urutan field rapot bisa dikonfigurasi dari `rapot_settings`

### Pencarian Global
- Satu kotak cari di semua database (santri aktif + arsip + alumni + pengajar)
- Role `admin`: akses penuh ke seluruh hasil pencarian (setara pimpinan)

### Kolom Dinamis Admin
- Tambah kolom custom ke form santri/alumni/pengajar/dewan
- Data di `extra` (JSONB), tidak ubah schema
- Tipe: text, number, date, select, textarea

---

## 13. Menu & Navigasi

### Struktur Sidebar

```
📊 Dashboard
│
├── 👩‍🎓 Santri
│   ├── Daftar Santri Aktif
│   ├── Naik Kelas (batch + mustahiq ikut)
│   └── Proses Keluar (lulus / boyong / keluar)
│
├── 📝 Penilaian
│   ├── Input Nilai Kuartal
│   ├── Hitung Nilai Khos (Smt 1 & 2)
│   ├── Nilai 'Am per Bagian
│   ├── Rapot Semester 1
│   ├── Rapot Semester 2
│   └── Al-Bayan (Nilai Prestasi Tahunan)
│
├── 📅 Absensi Perizinan
│
├── 🗄️ Database / Arsip
│   ├── Santri (semua status)
│   ├── Alumni (filter: lulus/boyong/keluar, tahun, dll.)
│   ├── Pengajar
│   └── Dewan Harian
│
├── 🔍 Pencarian Global
│
└── ⚙️ Admin (pimpinan only)
    ├── Manajemen Akun User
    ├── Manajemen Angkatan & Bagian
    ├── Manajemen Tingkatan
    ├── Manajemen Mata Pelajaran per Bagian
    ├── Kolom Dinamis
    ├── Pengaturan Rapot (header Arab, urutan field)
    └── Pengaturan Aplikasi
```

### Akses per Role

| Menu | Pimpinan | Admin | Mufatish | Mustahiq | Munawwib | Wali |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Santri Aktif | ✅ | ✅ | ✅ | ✅ Bagiannya | ✅ Bagiannya | ❌ |
| Input Nilai | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Input Absensi | ✅ | ✅ | ❌ | ✅ | ✅ **Bagiannya** | ❌ |
| Rapot | ✅ | ✅ | ✅ | ✅ Bagiannya | ❌ | ✅ Anaknya |
| Database/Arsip | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Pencarian | ✅ | ✅ | ✅ | ✅ | ✅ **Dasar+Prestasi** | ❌ |
| Naik Kelas / Proses Keluar | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Admin (akun, kolom, setting) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 14. Pedoman UI/UX (Referensi Visual)

Antarmuka aplikasi (UI/UX) dibangun dengan mengadopsi gaya visual yang elegan, profesional, modern, dan sangat responsif, merujuk langsung pada referensi desain yang disetujui.

### A. Tampilan Desktop (Admin, Pengajar, Pimpinan)
*   **Warna Tema & Latar:** Latar belakang utama menggunakan abu-abu sangat terang (`#F8F9FA` atau senada). Kartu-kartu data menggunakan latar putih murni dengan bayangan (*shadow*) lembut yang memberikan efek sedikit timbul (bukan *flat design* kaku).
*   **Sidebar Navigasi Kiri:** Menggunakan warna **biru solid/gradient** (`#2B5BDB` atau senada). Terdapat kategori menu dengan teks kecil (misal: UTAMA, DATA MASTER, AKADEMIK).
*   **Menu Aktif:** Menu yang sedang diakses di sidebar ditandai dengan latar belakang putih berbentuk kapsul (*pill-shaped*) dan teks berwarna gelap/biru.
*   **Top Banner / Header:** Menampilkan sapaan seperti `Welcome, [Nama]` dengan *background banner* berwarna gradasi biru melintang di bagian atas konten utama, dilengkapi inisial nama atau foto profil di sebelah kanan.
*   **Ikonografi:** Ikon-ikon di area konten (seperti pada kartu metrik) menggunakan gaya *outline* (garis) dengan warna-warni cerah yang modern (misal: jempol biru, detak jantung hijau, centang kuning). Sudut-sudut kartu sangat membulat (*rounded-2xl* atau *3xl*).

### B. Tampilan Mobile (Wali Santri, Munawwib, Akses Cepat)
*   **Top App Bar:** Bar navigasi atas berwarna gelap, memuat tombol *hamburger menu* (garis tiga) di kiri, logo aplikasi di tengah, dan ikon notifikasi (lonceng) di kanan.
*   **Hero Banner Melengkung:** Di bawah Top Bar, terdapat kotak selamat datang berwarna biru terang/gradasi dengan sudut bawah melengkung halus, memuat info nama dan peran pengguna.
*   **Grid Menu / Ikon Berkotak:** Menu-menu utama (Jadwal, Kelas, Siswa, Nilai) ditampilkan dalam bentuk *grid*. Setiap ikon berada di dalam kotak dengan sudut melengkung berlatar warna *pastel* sangat muda yang senada dengan warna ikonnya (ikon biru di kotak biru muda, ikon ungu di kotak ungu muda).
*   **Bottom Navigation Bar (Navigasi Bawah):** Terdapat bar melayang di bagian paling bawah layar untuk akses cepat ke menu utama (Beranda, Siswa, Ujian, Raport).
*   **Floating Action Button (FAB):** Di tengah-tengah Bottom Nav terdapat tombol besar bulat dengan ikon `+` (berwarna biru menonjol ke atas) sebagai pusat aksi cepat.

> **Pendekatan Teknis:** Kita akan menggunakan **Tailwind CSS v3** untuk dengan mudah mereplikasi sudut melengkung kustom, gradasi, bayangan lembut, dan tata letak grid yang fleksibel antara versi desktop dan ponsel ini.

---

## 15. Urutan Pengerjaan

```
FASE 1 — FONDASI
  [ ] Setup project Go + koneksi PostgreSQL (.env)
  [ ] Buat semua migrasi tabel (27 tabel)
  [ ] Sistem login: session cookie + bcrypt + force change password
  [ ] Login wali_santri: username=NIK, password awal=NIK, force change
  [ ] Middleware RBAC (6 role: pimpinan, admin, mufatish, mustahiq, munawwib, wali_santri)
  [ ] Scope filter munawwib: via pengajar_bagian WHERE peran='munawwib'

FASE 2 — DATA MASTER
  [ ] CRUD Tingkatan
  [ ] CRUD Angkatan
  [ ] CRUD Bagian (angkatan + tingkatan + subdivisi A1/A2)
  [ ] CRUD Santri (+ NIK + Nomor Stambuk)
  [ ] Assign santri ke bagian pertama (INSERT riwayat_bagian)
  [ ] CRUD Mata Pelajaran per bagian (dinamis)
  [ ] Penugasan Mustahiq ke Bagian
  [ ] Penugasan Mufatish ke Tingkatan

FASE 3 — NILAI & ABSENSI
  [ ] Grid input nilai kuartal (baris=siswi, kolom=mapel)
  [ ] Kalkulasi Jumlah & Rata-rata kuartal otomatis
  [ ] Input absensi perizinan (Bi Idzni / Bi Ghoirihi)
  [ ] Kalkulasi Nilai Khos + koreksi Akhlaq
  [ ] Kalkulasi Nilai 'Am (otomatis + bisa diedit)
  [ ] Kalkulasi Al-Bayan + koreksi prestasi tahunan

FASE 4 — PERPINDAHAN & ALUMNI
  [ ] Proses naik kelas batch + mustahiq ikut
  [ ] Proses pindah bagian (individual)
  [ ] Proses cuti & reaktivasi
  [ ] Proses keluar (lulus/boyong/keluar) → semua buat record alumni
  [ ] CRUD alumni (update khidmah & ijazah untuk yang lulus)

FASE 5 — DATABASE TAMBAHAN
  [ ] CRUD Pengajar (historis per tahun)
  [ ] CRUD Dewan Harian (P3HM/MPHM/M3PHM)

FASE 6 — PENCARIAN & ARSIP
  [ ] Pencarian global (santri, alumni, pengajar)
  [ ] Admin akses penuh (setara pimpinan)
  [ ] Halaman arsip dengan filter status & tahun

FASE 7 — RAPOT & LAPORAN
  [ ] Tampilan rapot semester (per siswi, per bagian)
  [ ] Header rapot custom bahasa Arab (dari rapot_settings)
  [ ] Rekap Al-Bayan per bagian / angkatan
  [ ] Laporan absensi perizinan per kuartal/tahun

FASE 8 — ADMIN & POLISH
  [ ] Manajemen akun (CRUD + reset password)
  [ ] Kolom dinamis admin
  [ ] Pengaturan rapot (header Arab, urutan field)
  [ ] Pengaturan aplikasi (nama, logo, dll.)
  [ ] UI/UX polish, responsif, testing kalkulasi
```

---

## 16. Checklist Verifikasi

### ✅ Kalkulasi Nilai
- [ ] Khos smt1: K1 ada → (K1+K2)/2, K1 kosong → K2/2
- [ ] Khos smt2: K3 ada → (K3+K4)/2, K3 kosong → K4/2
- [ ] Pembulatan: ≥ 0.5 ke atas, < 0.5 ke bawah
- [ ] Rentang Khos: min 4, maks 9
- [ ] Koreksi Akhlaq: bi_idzni ≥ 20/smt → -1, bi_ghoirihi ≥ 6/smt → -1
- [ ] Nilai 'Am: siswi belum Her dihitung nilai 4
- [ ] Al-Bayan koreksi: bi_idzni ≥ 15/tahun → -1, bi_ghoirihi ≥ 5/tahun → -1
- [ ] Kategori Al-Bayan: 5–9 sesuai label Arabic
- [ ] Nilai 'Am manual edit tersimpan dengan flag is_edited

### ✅ Perpindahan & Alumni
- [ ] Naik kelas → riwayat_bagian siswi terupdate
- [ ] Naik kelas → mustahiq_bagian ikut pindah
- [ ] Semua tipe keluar (lulus/boyong/keluar) → buat record alumni
- [ ] Lulus → kolom khidmah & ijazah tersedia
- [ ] Boyong/keluar → kolom khidmah/ijazah NULL, ada alasan
- [ ] Santri yang sudah jadi alumni tetap bisa dicari di pencarian global

### ✅ Hak Akses
- [ ] Login tiap role → menu sesuai matriks
- [ ] Mustahiq: tidak bisa lihat bagian lain
- [ ] Mufatish: tidak bisa input, hanya pantau
- [ ] Admin: akses penuh setara pimpinan (semua menu & aksi)
- [ ] Wali Santri: login NIK, tidak bisa lihat data santri lain

### ✅ Data Integritas
- [ ] Santri tidak pernah dihapus dari database
- [ ] Riwayat kelas tidak hilang saat naik/pindah/keluar
- [ ] Kolom dinamis tidak merusak data existing
- [ ] Nilai historis tetap ada meski santri sudah alumni

