#!/usr/bin/env bash
###############################################################################
# SIM Mubtadiat - Pemasang backup harian (cron 02:00 WIB + Cloudflare R2)
#
# Cara pakai (sebagai root):
#   sudo bash backup/install-backup.sh
#
# Auto-konfigurasi R2 (credential TIDAK pernah masuk repo — hanya ke
# /root/.config/rclone/rclone.conf dengan chmod 600):
#   sudo R2_ACCESS_KEY_ID=xxxxx R2_SECRET_ACCESS_KEY=yyyyy \
#        R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
#        R2_BUCKET=mubtadiat bash backup/install-backup.sh
#
# Tanpa R2_*: backup tetap terpasang (lokal dulu); jalankan ulang installer
# ini setelah credential diisi.
###############################################################################
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BK="$APP_DIR/backup"
[ -f "$BK/backup.sh" ] || { echo "[backup][ERROR] backup.sh tidak ditemukan di $BK" >&2; exit 1; }

log()  { printf '\033[1;36m[backup]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[backup][ERROR]\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Jalankan sebagai root: sudo bash backup/install-backup.sh"
command -v docker >/dev/null 2>&1 || die "Docker belum terpasang — jalankan deploy.sh dulu."

# --- 1. rclone ---------------------------------------------------------------
if ! command -v rclone >/dev/null 2>&1; then
  log "Memasang rclone..."
  apt-get update -qq && apt-get install -y -qq rclone
fi
log "rclone: $(rclone version | head -1)"

# --- 2. config R2 dari environment (opsional) -------------------------------
if [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ]; then
  : "${R2_ENDPOINT:?R2_ENDPOINT wajib diisi saat auto-config (mis. https://<account-id>.r2.cloudflarestorage.com)}"
  mkdir -p /root/.config/rclone
  cat > /root/.config/rclone/rclone.conf <<EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = ${R2_ENDPOINT}
disable_acl = true
EOF
  chmod 600 /root/.config/rclone/rclone.conf
  log "Config rclone R2 tertulis (/root/.config/rclone/rclone.conf, chmod 600)."
elif [ ! -f /root/.config/rclone/rclone.conf ]; then
  log "R2 belum dikonfigurasi — backup jalan lokal dulu."
  log "Nanti: R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_ENDPOINT=... bash $BK/install-backup.sh"
fi

# --- 3. folder + izin --------------------------------------------------------
mkdir -p "$BK/dumps" "$BK/logs"
chmod +x "$BK/backup.sh"

# --- 4. timezone WIB (biar cron 02:00 = 02:00 WIB) --------------------------
if command -v timedatectl >/dev/null 2>&1; then
  TZ_NOW="$(timedatectl show -p Timezone --value 2>/dev/null || true)"
  if [ "$TZ_NOW" != "Asia/Jakarta" ]; then
    timedatectl set-timezone Asia/Jakarta 2>/dev/null && log "Timezone → Asia/Jakarta."
  fi
fi

# --- 5. cron harian 02:00 WIB ------------------------------------------------
BUCKET="${R2_BUCKET:-mubtadiat}"
CRON=/etc/cron.d/simmubtadiat-backup
cat > "$CRON" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * root R2_BUCKET='${BUCKET}' $BK/backup.sh >/dev/null 2>&1
EOF
chmod 644 "$CRON"
log "Cron harian 02:00 WIB terpasang ($CRON)."

# --- 6. test run (non-fatal) --------------------------------------------------
log "Test run backup..."
"$BK/backup.sh" || true
log "Log terakhir:"
tail -n 6 "$(ls -t "$BK/logs"/backup_*.log | head -1)"
log "Selesai. Log harian: $BK/logs/"
