# SIM Mubtadiat

Sistem informasi manajemen pesantren — **Go (Fiber/chi) + PostgreSQL + Docker**,
dengan reverse proxy nginx dan SSL Let's Encrypt.

---

## 🚀 Instalasi One-Click — tinggal isi domain

Satu perintah. Semua (Docker, database, migrasi, seed admin, nginx, SSL)
dikerjakan `deploy.sh` otomatis.

### Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| VPS **Ubuntu 22.04** | akses `root` / `sudo` |
| **Domain** | mengarah ke VPS (bisa di-set otomatis lewat Cloudflare) |
| **Cloudflare API Token** | izin `Zone:DNS:Edit` — dipakai untuk SSL via DNS-01 |

### Jalankan

```bash
git clone https://github.com/rezaulin/simmubtadiat.git
cd simmubtadiat

sudo DOMAIN=app.contoh.id \
      CF_API_TOKEN=tempel_token_cloudflare_anda \
      LE_EMAIL=admin@contoh.id \
      bash deploy.sh
```

Itu saja. Saat selesai, layar menampilkan:

```
============================================================
  DEPLOY SELESAI  ✔
------------------------------------------------------------
  URL       : https://app.contoh.id
  Login     : admin
  Password  : (password admin — catat)
============================================================
```

> **Manual (interaktif)** — cukup `sudo bash deploy.sh`, lalu ikuti prompt
> (domain, email, token, password admin).

### Yang dikerjakan otomatis

1. `apt` update + pasang nginx, certbot, jq, ca-certificates
2. Pasang Docker & Docker Compose (kalau belum ada)
3. Buat `.env` dengan **rahasia acak** (`DB_PASS`, `JWT_SECRET`) + seed admin —
   `chmod 600`; kalau `.env` sudah ada, dipertahankan
4. Set **A record** di Cloudflare ke IP publik server (opsional, otomatis)
5. `docker compose up -d --build` → tunggu `/api/health` (maks 3 menit)
6. Terbitkan sertifikat **Let's Encrypt** (DNS-01 Cloudflare) —
   tetap jalan walau domain di-*proxy* (orange cloud)
7. Tulis konfigurasi **nginx** (redirect HTTP→HTTPS, proxy ke `127.0.0.1:8080`)
8. Aktifkan auto-renew certbot

### Variabel

| Variabel | Wajib? | Default | Fungsi |
|---|---|---|---|
| `DOMAIN` | **ya** | — | domain tujuan (mis. `app.contoh.id`) |
| `CF_API_TOKEN` | **ya** | — | Cloudflare token (`Zone:DNS:Edit`) untuk SSL |
| `LE_EMAIL` | **ya** | — | email notifikasi Let's Encrypt |
| `ADMIN_PASSWORD` | tidak | di-generate acak | password admin awal |
| `ADMIN_USERNAME` | tidak | `admin` | username admin awal |

---

## Setelah deploy

1. Buka `https://DOMAIN` → login memakai `ADMIN_USERNAME` + password dari output
2. **Ganti password admin** setelah login pertama
3. Di Cloudflare, set **SSL/TLS → Full (strict)**
4. Simpan `CF_API_TOKEN` di tempat aman (dipakai ulang saat renew/ulang deploy)

### Update aplikasi

```bash
git pull
sudo docker compose up -d --build
```

### Perintah harian

```bash
sudo docker compose logs -f app      # log aplikasi
sudo docker compose ps               # status container
sudo docker compose restart app      # restart aplikasi
curl -s https://DOMAIN/api/health    # cek kesehatan -> "OK"
```

---

## Struktur

```
docker-compose.yml
├── app    Go + frontend (build dari Dockerfile)
│          port 127.0.0.1:8080 — TIDAK diekspos ke publik
│          entrypoint: jalankan migrasi (idempoten) → ./main
│          volume: uploads/ (foto santri, tetap ada walau rebuild)
└── db     postgres:15-alpine — hanya jaringan internal compose
           volume: pgdata/
```

Akses publik **hanya lewat nginx** (reverse proxy + SSL) → container aplikasi
terikat di `127.0.0.1`.

---

## Konfigurasi (`.env`)

`deploy.sh` membuat `.env` otomatis dengan rahasia acak. Untuk referensi /
penulisan manual, lihat [`.env.example`](.env.example).

> `.env` berisi rahasia dan **tidak boleh** di-commit (sudah masuk `.gitignore`).

---

## Troubleshooting

| Gejala | Cek / perbaikan |
|---|---|
| Aplikasi tidak sehat | `sudo docker compose logs --tail=50 app` |
| Migrasi gagal saat start | log entrypoint: `Migrasi gagal. Server tidak dijalankan.` → jalankan ulang `sudo docker compose up -d --build` |
| `Zona Cloudflare ... tidak ditemukan` | set A record manual: `DOMAIN → IP server`, lalu jalankan ulang `deploy.sh` |
| SSL gagal | pastikan token punya izin `Zone:DNS:Edit`; ulangi `sudo bash deploy.sh` |
| Perubahan belum masuk | `git pull && sudo docker compose up -d --build` |

---

## Pengembangan (lokal)

```bash
# butuh: Go 1.22+, PostgreSQL 15, Node (untuk build frontend)
cp .env.example .env        # isi rahasia lokal
go run .                    # server di :8080

cd frontend && npm install && npm run build
```

Migrasi database dijalankan otomatis oleh `./migrate-runner migrations`
saat container start.
