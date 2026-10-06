#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Tes TAMPILAN naik kelas antar-TA:
# Pastikan setelah naik kelas, kartu tahun lama masih menampilkan KELAS LAMA,
# target juz lama, dan hasil penilaian lama — bukan ikut berubah.
#
# Menyalakan app kedua (port 8091) yang menunjuk db_uji (kloningan live), jadi
# aplikasi live tidak terganggu sedikit pun.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SRC_DB=mubtadiaat_db
TEST_DB=db_uji
PGUSER=mubtadiaat
APP=test-simmubtadiat-app
PORT=8091
BASE="http://127.0.0.1:$PORT"

psql_test() { docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d "$TEST_DB" -tAc "$1"; }
say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
ok()  { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
bad() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; }

cleanup() {
  say "Bersih-bersih"
  docker rm -f "$APP" >/dev/null 2>&1 || true
  docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null 2>&1 || true
  ok "container uji & db_uji dihapus"
}
trap cleanup EXIT

say "0. Siapkan db_uji (kloningan live)"
docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null
docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d postgres -c "CREATE DATABASE $TEST_DB;" >/dev/null
docker exec -i simmubtadiat-db-1 pg_dump -U "$PGUSER" "$SRC_DB" | docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d "$TEST_DB" >/dev/null
ok "db_uji siap"

# ── Pilih santri uji: yang punya data juz & kompetensi di TA berjalan ────────
say "1. Pilih santri uji (punya data di TA berjalan)"
TA_LAMA=$(psql_test "SELECT tahun_ajaran FROM kalender_kuartal WHERE CURRENT_DATE BETWEEN tgl_mulai AND tgl_selesai LIMIT 1;")
SANTRI_ID=$(psql_test "
  SELECT sj.santri_id FROM setoran_juz_amma sj
  JOIN santri s ON s.id=sj.santri_id
  WHERE s.status='aktif' AND sj.tahun_ajaran='$TA_LAMA'
  GROUP BY sj.santri_id ORDER BY count(*) DESC LIMIT 1;")
BAGIAN_LAMA=$(psql_test "SELECT bagian_id FROM santri WHERE id=$SANTRI_ID;")
LABEL_LAMA=$(psql_test "SELECT TRIM(k.nama||' '||t.nama||' '||b.nama_bagian) FROM bagian b JOIN kelas k ON k.id=b.kelas_id LEFT JOIN tingkatan t ON t.id=b.tingkatan_id WHERE b.id=$BAGIAN_LAMA;")
TARGET_LAMA=$(psql_test "SELECT max(surat_no) FROM setoran_juz_amma WHERE santri_id=$SANTRI_ID AND tahun_ajaran='$TA_LAMA';")
KOMP_LAMA=$(psql_test "SELECT string_agg(kategori, ',' ORDER BY kategori) FROM nilai_kompetensi WHERE santri_id=$SANTRI_ID AND tahun_ajaran='$TA_LAMA';")
ok "santri $SANTRI_ID | kelas $LABEL_LAMA | target surat $TARGET_LAMA | kompetensi [${KOMP_LAMA:-kosong}]"

say "2. Nyalakan app uji (port $PORT → db_uji)"
docker run -d --name "$APP" --network simmubtadiat_default \
  -e DB_HOST=simmubtadiat-db-1 -e DB_PORT=5432 -e DB_USER="$PGUSER" -e DB_PASS=mubtadiaat_secret \
  -e DB_NAME="$TEST_DB" -p "127.0.0.1:$PORT:8080" \
  "$(docker inspect simmubtadiat-app-1 --format '{{.Config.Image}}')" >/dev/null
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health" || true)
  [ "$code" = "200" ] && break; sleep 1
done
[ "${code:-}" = "200" ] || { bad "app uji gagal start"; docker logs "$APP" 2>&1 | tail -20; exit 1; }
ok "app uji siap di $BASE"

say "3. Login & ambil data SEBELUM naik kelas"
curl -s -c /tmp/jar_uji -X POST "$BASE/api/login" -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' >/dev/null
before_komp=$(curl -s -b /tmp/jar_uji "$BASE/api/penilaian-tambahan/kompetensi?tahun_ajaran=$(printf %s "$TA_LAMA" | jq -sRr @uri)" | jq -c "[.[]|select(.santri_id==$SANTRI_ID)]")
before_juz=$(curl -s -b /tmp/jar_uji "$BASE/api/penilaian-tambahan/juz-amma?tahun_ajaran=$(printf %s "$TA_LAMA" | jq -sRr @uri)" | jq -c "[.[]|select(.santri_id==$SANTRI_ID)|{bagian,surat_sampai,jumlah_surat}]")
ok "kompetensi TA lama SEBELUM: $before_komp"
ok "juz TA lama SEBELUM: $before_juz"

say "4. Naikkan ke kelas atas + TA baru (simulasi tanggal)"
TA_BARU=$(psql_test "SELECT tahun_ajaran FROM kalender_kuartal GROUP BY 1 ORDER BY 1 DESC LIMIT 1;")
BAGIAN_BARU=$(psql_test "
  SELECT b.id FROM bagian b JOIN kelas k ON k.id=b.kelas_id JOIN tingkatan t ON t.id=b.tingkatan_id
  WHERE b.id <> $BAGIAN_LAMA AND (t.urutan,k.nama) > (
    SELECT t2.urutan,k2.nama FROM bagian b2 JOIN kelas k2 ON k2.id=b2.kelas_id JOIN tingkatan t2 ON t2.id=b2.tingkatan_id WHERE b2.id=$BAGIAN_LAMA)
  ORDER BY t.urutan,k.nama LIMIT 1;")
LABEL_BARU=$(psql_test "SELECT TRIM(k.nama||' '||t.nama||' '||b.nama_bagian) FROM bagian b JOIN kelas k ON k.id=b.kelas_id LEFT JOIN tingkatan t ON t.id=b.tingkatan_id WHERE b.id=$BAGIAN_BARU;")
AKHIR=$(psql_test "SELECT max(tgl_selesai) FROM kalender_kuartal WHERE tahun_ajaran='$TA_LAMA';")
AWAL=$(psql_test "SELECT min(tgl_mulai) FROM kalender_kuartal WHERE tahun_ajaran='$TA_BARU';")
psql_test "UPDATE riwayat_bagian SET tanggal_selesai='$AKHIR' WHERE santri_id=$SANTRI_ID AND tanggal_selesai IS NULL;" >/dev/null
psql_test "INSERT INTO riwayat_bagian (santri_id,bagian_id,tanggal_mulai) VALUES ($SANTRI_ID,$BAGIAN_BARU,'$AWAL');" >/dev/null
psql_test "UPDATE santri SET bagian_id=$BAGIAN_BARU WHERE id=$SANTRI_ID;" >/dev/null
psql_test "UPDATE settings SET value='$TA_BARU' WHERE key='tahun_ajaran_aktif';" >/dev/null
ok "naik: $LABEL_LAMA → $LABEL_BARU ($TA_LAMA → $TA_BARU)"

say "5. Ambil data SESUDAH naik kelas & bandingkan"
after_komp=$(curl -s -b /tmp/jar_uji "$BASE/api/penilaian-tambahan/kompetensi?tahun_ajaran=$(printf %s "$TA_LAMA" | jq -sRr @uri)" | jq -c "[.[]|select(.santri_id==$SANTRI_ID)]")
after_juz=$(curl -s -b /tmp/jar_uji "$BASE/api/penilaian-tambahan/juz-amma?tahun_ajaran=$(printf %s "$TA_LAMA" | jq -sRr @uri)" | jq -c "[.[]|select(.santri_id==$SANTRI_ID)|{bagian,surat_sampai,jumlah_surat}]")
new_juz=$(curl -s -b /tmp/jar_uji "$BASE/api/penilaian-tambahan/juz-amma?tahun_ajaran=$(printf %s "$TA_BARU" | jq -sRr @uri)" | jq -c "[.[]|select(.santri_id==$SANTRI_ID)|{bagian,surat_sampai,disetor:([.surat[]|select(.setor)]|length)}]")
ok "kompetensi TA lama SESUDAH: $after_komp"
ok "juz TA lama SESUDAH: $after_juz"
ok "juz TA baru: $new_juz"

PASS=1
[ "$before_komp" = "$after_komp" ] && ok "kompetensi TA lama TIDAK BERUBAH ✓" || { bad "kompetensi TA lama BERUBAH!"; PASS=0; }
[ "$before_juz" = "$after_juz" ]  && ok "target juz TA lama TIDAK BERUBAH ✓" || { bad "target juz TA lama BERUBAH!"; PASS=0; }

say "KESIMPULAN"
[ "$PASS" = "1" ] && ok "LULUS: riwayat tahun sebelumnya utuh, tahun baru belum ternilai" || { bad "GAGAL"; exit 1; }
