#!/usr/bin/env bash
###############################################################################
# SIM Mubtadiat - Backup harian (cron 02:00 WIB)
#   pg_dump (diverifikasi pg_restore --list) + arsip uploads
#   → lokal (retensi 14 hari) → Cloudflare R2 (retensi 14 hari)
# Credential R2: /root/.config/rclone/rclone.conf (chmod 600) — lihat README.md
###############################################################################
set -u
TS=$(date +%Y%m%d_%H%M)
BK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUMPS="$BK/dumps"
LOG="$BK/logs/backup_$(date +%Y%m%d_%H%M).log"

# Bisa di-override lewat environment / baris cron:
R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:-mubtadiat}"
DB_CONTAINER="${DB_CONTAINER:-simmubtadiat-db-1}"
VOLUME_UPLOADS="${VOLUME_UPLOADS:-simmubtadiat_uploads}"

mkdir -p "$DUMPS" "$BK/logs"
log(){ echo "[$(date '+%F %T')] $*" >> "$LOG"; }

# Ejaan DB dibaca langsung dari container — salah ketik tak mungkin terjadi
DB_USER=$(docker exec "$DB_CONTAINER" printenv POSTGRES_USER 2>/dev/null) || {
  log "ERROR: container DB ($DB_CONTAINER) tak terjangkau"; exit 1; }
DB_NAME=$(docker exec "$DB_CONTAINER" printenv POSTGRES_DB)
log "mulai backup (db=$DB_NAME)"

# 1. dump database + verifikasi isi
if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" \
     > "$DUMPS/pg_$TS.dump" 2>>"$LOG"; then
  if docker exec -i "$DB_CONTAINER" pg_restore --list \
       < "$DUMPS/pg_$TS.dump" >/dev/null 2>&1; then
    log "pg_dump OK + verify OK ($(stat -c%s "$DUMPS/pg_$TS.dump") bytes)"
  else
    log "ERROR: file dump gagal diverifikasi"
  fi
else
  log "ERROR: pg_dump gagal"
fi

# 2. arsip uploads (volume docker — dibaca langsung dari host)
VOL_PATH="/var/lib/docker/volumes/${VOLUME_UPLOADS}/_data"
if [ -d "$VOL_PATH" ] && tar -czf "$DUMPS/uploads_$TS.tar.gz" -C "$VOL_PATH" . 2>>"$LOG"; then
  log "uploads OK ($(stat -c%s "$DUMPS/uploads_$TS.tar.gz") bytes)"
else
  log "WARN: uploads tidak dapat diarsipkan"
fi

# 3. retensi lokal 14 hari
find "$DUMPS" -mtime +14 -delete 2>/dev/null

# 4. push ke Cloudflare R2 + retensi remote 14 hari
if [ -f /root/.config/rclone/rclone.conf ]; then
  if rclone copy "$DUMPS" "$R2_REMOTE:$R2_BUCKET/dumps" --transfers 4 >>"$LOG" 2>&1; then
    log "R2 push OK (bucket: $R2_BUCKET)"
    rclone delete "$R2_REMOTE:$R2_BUCKET/dumps" --min-age 14d >>"$LOG" 2>&1 || true
    log "retensi R2 14 hari diterapkan"
  else
    log "ERROR: push R2 gagal"
  fi
else
  log "R2 belum dikonfigurasi — backup lokal saja"
fi
log "selesai"
