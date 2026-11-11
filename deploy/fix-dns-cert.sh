#!/bin/bash
# Fix wildcard DNS + issue wildcard cert *.reviewtechno.me (DNS-01).
# Token CF dibaca dari /root/.secrets/cloudflare.ini — tidak pernah dicetak.
set -e

ZONE="reviewtechno.me"
ORIGIN_IP="103.196.155.62"
CERTNAME="reviewtechno-wildcard"

TOKEN=$(awk -F= '/dns_cloudflare_api_token/ {print $2}' /root/.secrets/cloudflare.ini | tr -d ' "')
AUTH="Authorization: Bearer ${TOKEN}"
API="https://api.cloudflare.com/client/v4"

ZID=$(curl -s -H "$AUTH" "$API/zones?name=$ZONE" | jq -r '.result[0].id')
[ -n "$ZID" ] && [ "$ZID" != "null" ] || { echo "GAGAL: zone tidak ditemukan"; exit 1; }

echo "== 1. fix wildcard record -> $ORIGIN_IP =="
RID=$(curl -s -H "$AUTH" "$API/zones/$ZID/dns_records?type=A&name=*.$ZONE" | jq -r '.result[0].id')
if [ -z "$RID" ] || [ "$RID" = "null" ]; then
  echo "record wildcard belum ada — create"
  curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
    "$API/zones/$ZID/dns_records" \
    --data "{\"type\":\"A\",\"name\":\"*\",\"content\":\"$ORIGIN_IP\",\"proxied\":true}" | jq -r '.success'
else
  curl -s -X PATCH -H "$AUTH" -H "Content-Type: application/json" \
    "$API/zones/$ZID/dns_records/$RID" \
    --data "{\"content\":\"$ORIGIN_IP\"}" | jq -r '.success, .result.content'
fi

echo "== 2. issue wildcard cert (DNS-01, propagasi 30s) =="
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 \
  --cert-name "$CERTNAME" -d "*.$ZONE" \
  --non-interactive --agree-tos -m admin@$ZONE 2>&1 | tail -6

echo "== 3. cek cert =="
certbot certificates 2>/dev/null | grep -A3 "$CERTNAME" | head -5
