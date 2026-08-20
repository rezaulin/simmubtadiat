#!/usr/bin/env bash
###############################################################################
# SIM Mubtadiat - One-Click Deploy (Ubuntu 22.04)
#
# Memasang: Docker + Docker Compose, nginx, certbot (DNS-01 Cloudflare).
# Menjalankan: aplikasi (Go) + PostgreSQL via docker compose, auto-migrasi,
# seed admin, reverse proxy nginx, dan SSL Let's Encrypt via Cloudflare DNS-01
# (bekerja walau domain di-proxy/orange-cloud di Cloudflare).
#
# Cara pakai (sebagai root):
#   sudo bash deploy.sh
# atau non-interaktif:
#   sudo DOMAIN=app.contoh.id CF_API_TOKEN=xxxx ADMIN_PASSWORD=rahasia \
#        LE_EMAIL=admin@contoh.id bash deploy.sh
###############################################################################
set -euo pipefail

# --- Lokasi proyek (folder tempat skrip ini berada) -------------------------
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

log()  { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[deploy][ERROR]\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Jalankan sebagai root: sudo bash deploy.sh"

# --- Input ------------------------------------------------------------------
DOMAIN="${DOMAIN:-}"
CF_API_TOKEN="${CF_API_TOKEN:-}"
LE_EMAIL="${LE_EMAIL:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

if [ -z "$DOMAIN" ]; then read -rp "Domain (mis. app.contoh.id): " DOMAIN; fi
[ -n "$DOMAIN" ] || die "Domain wajib diisi."
if [ -z "$LE_EMAIL" ]; then read -rp "Email (untuk Let's Encrypt): " LE_EMAIL; fi
[ -n "$LE_EMAIL" ] || die "Email wajib diisi."
if [ -z "$CF_API_TOKEN" ]; then
  read -rsp "Cloudflare API Token (izin Zone:DNS:Edit): " CF_API_TOKEN; echo
fi
[ -n "$CF_API_TOKEN" ] || die "Cloudflare API Token wajib diisi."
if [ -z "$ADMIN_PASSWORD" ]; then
  read -rsp "Password admin awal (kosongkan untuk generate otomatis): " ADMIN_PASSWORD; echo
fi

rand() { head -c "${1:-32}" /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "${1:-32}"; }
[ -n "$ADMIN_PASSWORD" ] || ADMIN_PASSWORD="$(rand 16)"

# --- 1. Paket sistem --------------------------------------------------------
log "Memperbarui apt & memasang prasyarat..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release nginx certbot python3-certbot-dns-cloudflare jq

# --- 2. Docker + Compose plugin --------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Memasang Docker..."
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin || true
fi
systemctl enable --now docker

# --- 3. Berkas .env (rahasia acak) -----------------------------------------
if [ ! -f "$APP_DIR/.env" ]; then
  log "Membuat .env dengan rahasia acak..."
  cat > "$APP_DIR/.env" <<EOF
DB_USER=mubtadiaat
DB_PASS=$(rand 24)
DB_NAME=mubtadiaat_db
JWT_SECRET=$(rand 40)
SEED_ADMIN_USERNAME=${ADMIN_USERNAME}
SEED_ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
  chmod 600 "$APP_DIR/.env"
else
  log ".env sudah ada — dipakai apa adanya (rahasia lama dipertahankan)."
  # Pastikan seed admin terpasang untuk run pertama.
  grep -q '^SEED_ADMIN_USERNAME=' "$APP_DIR/.env" || echo "SEED_ADMIN_USERNAME=${ADMIN_USERNAME}" >> "$APP_DIR/.env"
  grep -q '^SEED_ADMIN_PASSWORD=' "$APP_DIR/.env" || echo "SEED_ADMIN_PASSWORD=${ADMIN_PASSWORD}" >> "$APP_DIR/.env"
fi

# --- 4. (Opsional) Set A record di Cloudflare ke IP server ------------------
SERVER_IP="$(curl -fsSL https://api.ipify.org || true)"
if [ -n "$SERVER_IP" ]; then
  log "IP publik server: $SERVER_IP — mencoba menyetel A record di Cloudflare..."
  ZONE="$DOMAIN"; ZONE_ID=""
  while [ -n "$ZONE" ]; do
    ZONE_ID="$(curl -fsSL -H "Authorization: Bearer $CF_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/zones?name=${ZONE}&status=active" | jq -r '.result[0].id // empty' || true)"
    [ -n "$ZONE_ID" ] && break
    case "$ZONE" in *.*.*) ZONE="${ZONE#*.}";; *) break;; esac
  done
  if [ -n "$ZONE_ID" ]; then
    REC_ID="$(curl -fsSL -H "Authorization: Bearer $CF_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=A&name=${DOMAIN}" | jq -r '.result[0].id // empty' || true)"
    PAYLOAD="{\"type\":\"A\",\"name\":\"${DOMAIN}\",\"content\":\"${SERVER_IP}\",\"ttl\":1,\"proxied\":true}"
    if [ -n "$REC_ID" ]; then
      curl -fsSL -X PUT -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
        "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${REC_ID}" --data "$PAYLOAD" >/dev/null && log "A record diperbarui."
    else
      curl -fsSL -X POST -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
        "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" --data "$PAYLOAD" >/dev/null && log "A record dibuat."
    fi
  else
    err "Zona Cloudflare untuk $DOMAIN tidak ditemukan otomatis. Pastikan A record $DOMAIN -> $SERVER_IP sudah ada."
  fi
fi

# --- 5. Build & jalankan container (app + db) ------------------------------
log "Build & menjalankan container (app + PostgreSQL)... (bisa beberapa menit)"
docker compose up -d --build

log "Menunggu aplikasi sehat di 127.0.0.1:8080 ..."
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
    log "Aplikasi sehat."; break
  fi
  sleep 3
  [ "$i" -eq 60 ] && { docker compose logs --tail=50 app; die "Aplikasi tidak sehat dalam waktu yang ditentukan."; }
done

# --- 6. Sertifikat SSL via Cloudflare DNS-01 --------------------------------
CF_INI="/root/.secrets/cloudflare.ini"
mkdir -p /root/.secrets
cat > "$CF_INI" <<EOF
dns_cloudflare_api_token = ${CF_API_TOKEN}
EOF
chmod 600 "$CF_INI"

log "Menerbitkan sertifikat Let's Encrypt (DNS-01 Cloudflare) untuk $DOMAIN ..."
certbot certonly --non-interactive --agree-tos --email "$LE_EMAIL" \
  --dns-cloudflare --dns-cloudflare-credentials "$CF_INI" \
  --dns-cloudflare-propagation-seconds 30 \
  -d "$DOMAIN"

# --- 7. Konfigurasi nginx reverse proxy ------------------------------------
log "Menulis konfigurasi nginx..."
NGINX_SITE="/etc/nginx/sites-available/simmubtadiat.conf"
cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    # Gaya nginx 1.18 (Ubuntu 22.04): http2 disatukan di direktif listen.
    # Direktif "http2 on;" terpisah baru didukung nginx >= 1.25.1.
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/simmubtadiat.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
systemctl enable nginx

# --- 8. Auto-renew (certbot timer sudah aktif by default) -------------------
systemctl enable --now certbot.timer >/dev/null 2>&1 || true

# --- Selesai ----------------------------------------------------------------
cat <<EOF

============================================================
  DEPLOY SELESAI  ✔
------------------------------------------------------------
  URL       : https://${DOMAIN}
  Login     : ${ADMIN_USERNAME}
  Password  : ${ADMIN_PASSWORD}
------------------------------------------------------------
  Catatan:
  - Set SSL/TLS mode di Cloudflare ke "Full (strict)".
  - Ganti password admin setelah login pertama.
  - Update aplikasi: git pull && sudo docker compose up -d --build
  - Log aplikasi   : sudo docker compose logs -f app
============================================================
EOF
