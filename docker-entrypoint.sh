#!/bin/sh
# Entrypoint container aplikasi: jalankan migrasi (idempoten) lalu start server.
set -e

echo "[entrypoint] Menjalankan migrasi database..."
./migrate-runner migrations || {
  echo "[entrypoint] Migrasi gagal. Server tidak dijalankan." >&2
  exit 1
}

echo "[entrypoint] Memulai server..."
exec ./main
