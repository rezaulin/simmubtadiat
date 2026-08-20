# Panduan Deploy SIM Mubtadiat (Ubuntu 22.04 + Cloudflare)

Deploy one-click: Docker (app + PostgreSQL) + nginx (reverse proxy) + SSL Let's Encrypt
via **Cloudflare DNS-01** (bekerja walau domain di-proxy / orange-cloud).

## Prasyarat
1. **VPS Ubuntu 22.04**, akses root/sudo, port **80 & 443** terbuka.
2. **Domain di Cloudflare** (nameserver sudah mengarah ke Cloudflare).
3. **Cloudflare API Token** dengan izin **Zone → DNS → Edit** untuk zona domainmu.
   - Buat di: Cloudflare Dashboard → My Profile → API Tokens → Create Token →
     template "Edit zone DNS" → pilih zona → Create → salin token.
4. Cloudflare **SSL/TLS mode**: set ke **Full (strict)**.

## Langkah
```bash
# 1) Salin kode ke server (git clone / scp), lalu masuk foldernya
cd /opt
git clone <repo-atau-upload> simmubtadiat
cd simmubtadiat

# 2) Jalankan one-click (interaktif — akan menanyakan domain, token, email, password)
sudo bash deploy.sh
```

Atau non-interaktif:
```bash
sudo DOMAIN=app.contoh.id \
     CF_API_TOKEN=xxxxxxxxxxxxxxxxxxxx \
     LE_EMAIL=admin@contoh.id \
     ADMIN_USERNAME=admin \
     ADMIN_PASSWORD=RahasiaKuat123 \
     bash deploy.sh
```

Skrip otomatis:
- Memasang Docker, nginx, certbot (plugin Cloudflare).
- Membuat `.env` dengan password DB & JWT acak.
- (Opsional) menyetel A record `DOMAIN → IP server` di Cloudflare (proxied).
- Build & menjalankan container (aplikasi + PostgreSQL), **auto-migrasi**, **seed admin**.
- Menerbitkan sertifikat SSL (DNS-01) + konfigurasi nginx + auto-renew.

Selesai → buka `https://DOMAIN`, login pakai akun admin yang ditampilkan di akhir skrip.
**Ganti password admin setelah login pertama.**

## Operasional

> Untuk **update aplikasi yang sudah live tanpa menghapus database/kredensial**,
> ikuti **PANDUAN_UPDATE.md** (berisi alur git & tar+scp yang aman + backup).

```bash
# Lihat log aplikasi
sudo docker compose logs -f app

# Update aplikasi (setelah git pull kode terbaru) — lihat PANDUAN_UPDATE.md
git pull
sudo docker compose up -d --build   # migrasi baru berjalan otomatis saat start

# Restart
sudo docker compose restart

# Backup database
sudo docker compose exec db pg_dump -U mubtadiaat mubtadiaat_db > backup_$(date +%F).sql

# Restore database
cat backup.sql | sudo docker compose exec -T db psql -U mubtadiaat -d mubtadiaat_db
```

## Catatan teknis
- **Data aman saat rebuild**: database di volume `pgdata`, upload foto di volume `uploads`,
  tanda tangan mudir tersimpan di DB. `docker compose up --build` tidak menghapusnya.
- **Migrasi idempoten**: dilacak di tabel `schema_migrations`; tiap berkas hanya jalan sekali.
- **Keamanan**: PostgreSQL tidak diekspos ke publik (hanya jaringan internal Docker);
  aplikasi hanya di-bind ke `127.0.0.1:8080` lalu diakses lewat nginx (HTTPS).
- **SSL auto-renew**: melalui `certbot.timer` (systemd), memakai kredensial Cloudflare
  di `/root/.secrets/cloudflare.ini`.

## Masalah umum
- **Sertifikat gagal terbit**: pastikan API Token benar (Zone:DNS:Edit) dan domain
  ada di Cloudflare. Coba ulang: `sudo bash deploy.sh`.
- **502 Bad Gateway**: aplikasi belum sehat. Cek `sudo docker compose logs app`.
- **Login gagal**: pastikan Cloudflare SSL mode **Full (strict)** (bukan Flexible).
