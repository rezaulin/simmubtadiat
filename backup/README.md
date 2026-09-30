# Backup Harian SIM Mubtadiat

Backup otomatis tiap **02:00 WIB** (cron): `pg_dump` + arsip uploads →
**lokal 14 hari** → **Cloudflare R2 14 hari**. Setiap dump diverifikasi
(`pg_restore --list`) supaya file rusak langsung ketahuan.

## Instal baru (otomatis lewat deploy)

Sediakan credential R2 saat deploy — `deploy.sh` akan memasangnya sendiri:

```bash
sudo R2_ACCESS_KEY_ID=xxxx \
     R2_SECRET_ACCESS_KEY=yyyy \
     R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
     R2_BUCKET=mubtadiat \
     DOMAIN=app.contoh.id CF_API_TOKEN=zzz LE_EMAIL=admin@contoh.id \
     bash deploy.sh
```

Belum ada credential? Lewati saja — backup lokal tetap terpasang, credential
bisa ditambahkan kapan saja (dua langkah di bawah).

## Pasang manual (server yang sudah jalan)

```bash
# 1. pasang cron + folder (backup lokal langsung jalan)
sudo bash backup/install-backup.sh

# 2. begitu punya credential R2, aktifkan push ke cloud (jalankan ulang):
sudo R2_ACCESS_KEY_ID=xxxx R2_SECRET_ACCESS_KEY=yyyy \
     R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
     R2_BUCKET=mubtadiat bash backup/install-backup.sh
```

## Mendapatkan credential R2

1. Cloudflare Dashboard → **R2** → **Create bucket** (mis. `mubtadiat`, region APAC).
2. **Manage R2 API Tokens** → **Create API Token** → permissions
   **Object Read & Write** → scope bucket itu.
3. Halaman hasil menampilkan: **Access Key ID**, **Secret Access Key**,
   **Endpoint** — itulah ketiga nilai `R2_*` di atas.

> Credential disimpan **hanya** di `/root/.config/rclone/rclone.conf`
> (chmod 600) — tidak pernah masuk repo.

## Lokasi

| Apa | Di mana |
|---|---|
| Skrip backup | `backup/backup.sh` |
| Installer | `backup/install-backup.sh` |
| Cron | `/etc/cron.d/simmubtadiat-backup` (02:00 WIB) |
| Dump lokal | `backup/dumps/` (retensi 14 hari) |
| Log | `backup/logs/backup_YYYYMMDD_HHMM.log` |
| Remote | `r2:<bucket>/dumps/` (retensi 14 hari) |

## Verifikasi cepat

```bash
sudo bash backup/backup.sh          # run manual
tail backup/logs/backup_*.log       # harus: "R2 push OK (bucket: ...)"
rclone ls r2:mubtadiat/dumps        # isi bucket
```

## Troubleshooting

- **`ERROR: push R2 gagal`** — cek credential/endpoint di log; jalankan ulang
  installer dengan `R2_*` yang benar.
- **`container DB tak terjangkau`** — `docker compose up -d` dulu.
- **Cron tidak jalan** — cek `systemctl status cron` dan `/etc/cron.d/simmubtadiat-backup`;
  zona waktu harus `Asia/Jakarta` (installer sudah menyetelnya).
