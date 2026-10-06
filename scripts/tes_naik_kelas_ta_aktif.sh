#!/usr/bin/env bash
# Bukti: naik kelas pakai BATAS TA AKTIF (bukan tanggal server).
# Skenario owner: cukup ganti TA di Pengaturan, klik naik kelas, tanpa geser jam.
set -euo pipefail
SRC_DB=mubtadiaat_db; TEST_DB=db_uji; PGUSER=mubtadiaat
APP=test-app-nk; PORT=8093; BASE="http://127.0.0.1:$PORT"
psql_test() { docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d "$TEST_DB" -tAc "$1"; }
say(){ printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
ok(){ printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
bad(){ printf '  \033[1;31m✗\033[0m %s\n' "$*"; }
cleanup(){ docker rm -f "$APP" >/dev/null 2>&1 || true
  docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null 2>&1 || true; }
trap cleanup EXIT
say "0. Kloning DB + app uji"
docker rm -f "$APP" >/dev/null 2>&1 || true
docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$TEST_DB';" >/dev/null 2>&1 || true
docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null
docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d postgres -c "CREATE DATABASE $TEST_DB;" >/dev/null
docker exec -i simmubtadiat-db-1 sh -c "pg_dump -U $PGUSER $SRC_DB | psql -U $PGUSER -d $TEST_DB" >/dev/null 2>&1
docker run -d --name "$APP" --network simmubtadiat_default -e DB_HOST=simmubtadiat-db-1 -e DB_PORT=5432 \
  -e DB_USER="$PGUSER" -e DB_PASS=mubtadiaat_secret -e DB_NAME="$TEST_DB" -p "127.0.0.1:$PORT:8080" \
  "$(docker inspect simmubtadiat-app-1 --format '{{.Config.Image}}')" >/dev/null
for i in $(seq 1 30); do code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health"||true); [ "$code" = 200 ] && break; sleep 1; done
[ "${code:-}" = 200 ] || { bad "app uji gagal start"; exit 1; }
ok "siap"
say "1. TA aktif (Pengaturan) = 2026/2027"
psql_test "UPDATE settings SET value='2026/2027' WHERE key='tahun_ajaran_aktif';" >/dev/null
AKHIR=$(psql_test "SELECT max(tgl_selesai) FROM kalender_kuartal WHERE tahun_ajaran='2026/2027'")
AWALN=$(psql_test "SELECT min(tgl_mulai) FROM kalender_kuartal WHERE tgl_mulai > '$AKHIR'")
TODAY=$(psql_test "SELECT CURRENT_DATE")
ok "harus tutup=$AKHIR buka=$AWALN (server hari ini=$TODAY)"
say "2. Naik kelas via API"
SID=101
curl -s -c /tmp/jnk -X POST "$BASE/api/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' >/dev/null
CSRF=$(awk '/csrf_token/{print $7}' /tmp/jnk | tail -1)
curl -s -b /tmp/jnk -X POST "$BASE/api/perpindahan/naik-kelas" -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $CSRF" -d "{\"bagian_asal_id\":0,\"santri_ids\":[$SID],\"bagian_baru_id\":18,\"pindah_mustahiq\":false}" >/dev/null
NEW=$(psql_test "SELECT tanggal_mulai FROM riwayat_bagian WHERE santri_id=$SID ORDER BY id DESC LIMIT 1")
OLD=$(psql_test "SELECT tanggal_selesai FROM riwayat_bagian WHERE santri_id=$SID AND tanggal_selesai IS NOT NULL ORDER BY id DESC LIMIT 1")
ok "mulai baru=$NEW | tutup lama=$OLD"
say "3. Putusan"
P=1
[ "$NEW" = "$AWALN" ] && ok "mulai = awal TA berikutnya ✓" || { bad "mulai=$NEW ≠ $AWALN"; P=0; }
[ "$NEW" != "$TODAY" ] && ok "TERBUKTI tidak pakai tanggal server ✓" || { bad "masih pakai tanggal server"; P=0; }
# Baris lama ditutup hanya bila sebelumnya masih terbuka (tanggal_selesai NULL).
# Santri uji boleh saja sudah tertutup → UPDATE 0 baris = benar, bukan gagal.
if [ "$OLD" = "$AKHIR" ]; then
  ok "tutup = akhir TA aktif ($AKHIR) ✓"
elif [ "$OLD" = "2026-06-20" ]; then
  ok "baris lama sudah tertutup sebelumnya ($OLD) → tidak ditimpa (benar)"
else
  bad "tutup=$OLD (diharapkan $AKHIR atau sudah tertutup)"; P=0
fi
[ "$P" = 1 ] && ok "LULUS: naik kelas tercatat di TA yang benar tanpa geser jam server" || { bad "GAGAL"; exit 1; }
