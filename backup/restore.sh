#!/usr/bin/env bash
# restore.sh — Kembalikan DB live dari file backup .sql
#
# Pakai:
#   ./backup/restore.sh backup/full_live_before_uji_20261006_095213.sql
#
# Membuat backup pengaman dulu (pre_restore_<ts>.sql) sebelum menimpa.

set -euo pipefail

cd "$(dirname "$0")/.."

DUMP="${1:-}"
DB_CONTAINER="simmubtadiat-db-1"
DB_USER="mubtadiaat"
DB_NAME="mubtadiaat_db"

if [[ -z "$DUMP" ]]; then
  echo "ERROR: sebutkan file backup .sql" >&2
  echo "Contoh: ./backup/restore.sh backup/full_live_before_uji_20261006_095213.sql" >&2
  echo >&2
  echo "File backup tersedia:" >&2
  ls -1t backup/*.sql 2>/dev/null | head >&2
  exit 1
fi

[[ -f "$DUMP" ]] || { echo "ERROR: file tidak ada: $DUMP" >&2; exit 1; }

echo "==> Backup pengaman dulu (kondisi sekarang)..."
TS=$(date +%Y%m%d_%H%M%S)
SAFETY="backup/pre_restore_${TS}.sql"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl > "$SAFETY"
echo "    tersimpan: $SAFETY"

echo "==> Restore dari: $DUMP"
read -r -p "Lanjut timpa DB live '$DB_NAME'? (ketik YA) : " KONFIRM
[[ "$KONFIRM" == "YA" ]] || { echo "Dibatalkan."; exit 0; }

echo "==> Tulis ulang skema + data (DROP/CREATE)..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 < "$DUMP" > /dev/null

echo "==> Restart app..."
docker compose restart app > /dev/null

echo
echo "SELESAI. DB '$DB_NAME' sudah kembali ke isi $DUMP"
echo "Kalau ternyata salah, bisa balik lagi dari: $SAFETY"
