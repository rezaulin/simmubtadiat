# Panduan Update SIM Mubtadiat (Tanpa Hapus Database & Kredensial)

Panduan ini untuk **memperbarui aplikasi yang sudah live** di VPS tanpa kehilangan
data (santri, nilai, absensi, foto, tanda tangan) maupun kredensial (password DB/JWT).

Ada dua cara update: **A. Git (disarankan)** atau **B. tar + scp**. Pilih salah satu.

---

## 0. Prinsip Aman (WAJIB dipahami)

Yang **AMAN** (tidak menghapus data):
- `sudo docker compose up -d --build` → rebuild image lalu restart. Volume
  `pgdata` (database) & `uploads` (foto) **tetap utuh**.
- `sudo docker compose restart`, `stop`, `start` → tidak menyentuh data.
- Migrasi berjalan otomatis saat start, **idempoten** (tiap berkas hanya sekali,
  dilacak di tabel `schema_migrations`). Migrasi baru menambah, bukan menghapus.

Yang **BERBAHAYA** (JANGAN dijalankan kecuali sengaja ingin menghapus semua data):
- `docker compose down -v`  ← flag `-v` menghapus volume = **DATABASE HILANG**.
- `docker volume rm ..._pgdata` / `docker volume prune`.
- Menimpa berkas **`.env`** di VPS dengan `.env` dari komputer lokal
  → password DB berganti, aplikasi tak bisa konek ke database lama.

Aturan emas:
1. **Selalu backup database sebelum update** (lihat bagian 3).
2. **Jangan pernah upload/timpa `.env`** yang ada di VPS.
3. Cukup gunakan `docker compose down` **tanpa** `-v`, atau langsung `up -d --build`.

---

## 1. (Sekali saja) Menyiapkan Git

### Di komputer lokal (Windows, folder `d:\mubtadiaat app`)
Repo git sudah diinisialisasi. Hubungkan ke remote (GitHub/GitLab), lalu push:
```powershell
git add .
git commit -m "Update aplikasi"
git branch -M main
git remote add origin https://github.com/USER/NAMA-REPO.git   # sekali saja
git push -u origin main
```
Untuk push berikutnya cukup:
```powershell
git add .
git commit -m "pesan perubahan"
git push
```

Catatan: `.env`, `*.db`, `*.exe`, `node_modules`, `public/dist` sudah diabaikan
oleh `.gitignore` sehingga **rahasia tidak ikut ter-push** dan tidak akan
menimpa `.env` di VPS.

### Di VPS (sekali saja) — jadikan folder deploy sebagai working copy git
Jika `/opt/simmubtadiat` belum berupa repo git:
```bash
cd /opt/simmubtadiat
# Amankan .env yang sudah ada
cp .env /root/env-backup-$(date +%F)
git init
git remote add origin https://github.com/USER/NAMA-REPO.git
git fetch origin
git checkout -f main        # .env tidak tertimpa karena di-gitignore
```
Pastikan `.env` masih ada setelah checkout:
```bash
ls -l /opt/simmubtadiat/.env
```
Kalau hilang (mis. dulu ter-commit), pulihkan dari backup:
```bash
cp /root/env-backup-* /opt/simmubtadiat/.env
```

---

## 2. Update Aplikasi

### Cara A — Git (disarankan)
Di komputer lokal: commit + push (lihat bagian 1).
Di VPS:
```bash
cd /opt/simmubtadiat
sudo docker compose exec db pg_dump -U mubtadiaat mubtadiaat_db > /root/backup_$(date +%F_%H%M).sql   # backup dulu
git pull                          # ambil kode terbaru (.env aman, di-gitignore)
sudo docker compose up -d --build # rebuild + restart; migrasi baru jalan otomatis
sudo docker compose logs -f app   # pantau: pastikan migrasi sukses & server start
```

### Cara B — tar + scp (tanpa git)
Di komputer lokal (`d:\mubtadiaat app`) — **PENTING: exclude `.env`**:
```powershell
tar --exclude=.env --exclude=.git --exclude=node_modules --exclude=public/dist --exclude="*.exe" --exclude="*.db" --exclude=tmp -czf sim.tar.gz .
scp sim.tar.gz ubuntu@IP_VPS:/tmp/sim.tar.gz
```
*(Catatan: kita upload ke `/tmp/` dulu karena user `ubuntu` tidak punya akses langsung ke `/opt`)*

Di VPS:
```bash
cd /opt/simmubtadiat
sudo docker compose exec db pg_dump -U mubtadiaat mubtadiaat_db > /root/backup_$(date +%F_%H%M).sql   # backup dulu
sudo cp /tmp/sim.tar.gz .         # copy file zip ke folder project
sudo tar --no-same-owner --no-same-permissions -xzf sim.tar.gz   # timpa kode; .env TIDAK ada di arsip jadi aman
sudo docker compose up -d --build
sudo docker compose logs -f app
```

Selesai. Karena frontend dirakit ulang di dalam container, perubahan tampilan
ikut ter-update tanpa perlu upload `public/dist`.

---

## 3. Backup & Restore Database

Backup (lakukan sebelum tiap update):
```bash
cd /opt/simmubtadiat
sudo docker compose exec db pg_dump -U mubtadiaat mubtadiaat_db > /root/backup_$(date +%F_%H%M).sql
```

Restore (jika perlu mengembalikan):
```bash
cat /root/backup_XXXX.sql | sudo docker compose exec -T db psql -U mubtadiaat -d mubtadiaat_db
```

Backup foto (volume uploads) — opsional:
```bash
docker run --rm -v simmubtadiat_uploads:/data -v /root:/backup alpine \
  tar czf /backup/uploads_$(date +%F).tar.gz -C /data .
```

---

## 4. Setelah Update — Muat Aset Baru di Perangkat

Aplikasi ini PWA, jadi browser/HP sempat menyimpan (cache) versi lama:
- **HP/PWA**: tutup lalu buka lagi aplikasi, atau tarik-untuk-segarkan. Bila masih
  lama, buka sekali di browser biasa untuk memicu pembaruan service worker.
- **Desktop**: `Ctrl + Shift + R` (hard refresh).

Versi cache dinaikkan lewat `CACHE` di `frontend/public/sw.js`; menaikkannya
memaksa semua klien mengambil aset terbaru pada kunjungan berikutnya.

---

## 5. Verifikasi & Troubleshooting

Cek status:
```bash
sudo docker compose ps                 # semua service "Up"
sudo docker compose logs --tail=80 app # log migrasi & server
```

Log migrasi yang sehat menampilkan salah satu dari:
- `Baseline diterapkan ... + N migrasi ditandai selesai.` (DB baru), atau
- `Migrasi diterapkan: 0XX_...` lalu `Selesai. N migrasi baru diterapkan.` (DB berisi)
diikuti server mulai melayani permintaan.

Masalah umum:
- **`.env` tidak sengaja tertimpa / DB tak konek**: pulihkan `.env` dari
  `/root/env-backup-*` lalu `sudo docker compose up -d`.
- **Halaman masih tampil lama**: cache PWA — lihat bagian 4 (hard refresh / buka ulang app).
- **502 Bad Gateway**: aplikasi belum sehat, cek `sudo docker compose logs app`.
- **Ingin membatalkan update (rollback)**:
  - Git: `git log --oneline` → `git checkout <commit-lama>` → `up -d --build`.
  - Lalu (bila perlu) restore database dari backup (bagian 3).

---

## 6. Ringkasan Perintah Cepat

| Tujuan | Perintah (di `/opt/simmubtadiat`) |
|---|---|
| Backup DB | `sudo docker compose exec db pg_dump -U mubtadiaat mubtadiaat_db > /root/backup_$(date +%F_%H%M).sql` |
| Update (git) | `git pull && sudo docker compose up -d --build` |
| Update (tar) | `tar -xzf sim.tar.gz && sudo docker compose up -d --build` |
| Lihat log | `sudo docker compose logs -f app` |
| Restart | `sudo docker compose restart` |
| ❌ JANGAN | `docker compose down -v` (menghapus database!) |

> Intinya: **backup dulu**, **jangan pakai `-v`**, **jangan timpa `.env`**.
> Update cukup `pull`/`extract` lalu `up -d --build` — data & kredensial aman.
