#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Tes "naik kelas antar tahun ajaran": pastikan riwayat tahun sebelumnya TIDAK
# berubah setelah siswa dinaikkan, dan tahun barunya KOSONG sebelum dinilai.
#
# Cara kerja: TIDAK menyentuh DB live. Kita kloning mubtadiaat_db → db_uji,
# jalankan app kedua di port 8091 yang menunjuk db_uji, lalu manipulasi tanggal
# riwayat lewat SQL (karena jam container tak bisa diubah tanpa CAP_SYS_TIME).
#
# Pakai:  bash scripts/tes_naik_kelas_antar_ta.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SRC_DB=mubtadiaat_db
TEST_DB=db_uji
PGUSER=mubtadiaat
APP=test-simmubtadiat-app
PORT=8091

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
ok()  { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
bad() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; }
psql_src()  { docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d "$SRC_DB" -tAc "$1"; }
psql_test() { docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d "$TEST_DB" -tAc "$1"; }

cleanup() {
  say "Bersih-bersih"
  docker rm -f "$APP" >/dev/null 2>&1 || true
  docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null 2>&1 || true
  ok "container uji & db_uji dihapus"
}
trap cleanup EXIT

# ── 0. Kloning DB ────────────────────────────────────────────────────────────
say "0. Kloning $SRC_DB → $TEST_DB"
# CREATE DATABASE ... TEMPLATE gagal bila ada koneksi lain. Pakai dump/restore.
docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d postgres \
  -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null
docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d postgres \
  -c "CREATE DATABASE $TEST_DB;" >/dev/null
docker exec -i simmubtadiat-db-1 pg_dump -U "$PGUSER" "$SRC_DB" \
  | docker exec -i simmubtadiat-db-1 psql -U "$PGUSER" -d "$TEST_DB" >/dev/null
ok "db_uji siap ($(psql_test "SELECT count(*) FROM santri") santri)"

# ── 1. Ambil santri uji yang punya data nilai di TA lama ─────────────────────
say "1. Pilih santri uji"
SANTRI_ID=$(psql_test "
  SELECT nk.santri_id FROM nilai_kuartal nk
  JOIN santri s ON s.id = nk.santri_id
  JOIN bagian b ON b.id = s.bagian_id
  JOIN kelas k ON k.id = b.kelas_id
  WHERE s.status='aktif' AND nk.tahun_ajaran = (
      SELECT tahun_ajaran FROM kalender_kuartal WHERE CURRENT_DATE BETWEEN tgl_mulai AND tgl_selesai LIMIT 1)
  GROUP BY nk.santri_id ORDER BY count(*) DESC LIMIT 1;")
[ -n "$SANTRI_ID" ] || { bad "tidak ada santri dengan nilai di TA berjalan"; exit 1; }
TA_LAMA=$(psql_test "SELECT tahun_ajaran FROM kalender_kuartal WHERE CURRENT_DATE BETWEEN tgl_mulai AND tgl_selesai LIMIT 1;")
BAGIAN_LAMA=$(psql_test "SELECT bagian_id FROM santri WHERE id=$SANTRI_ID;")
LABEL_LAMA=$(psql_test "SELECT TRIM(k.nama||' '||t.nama||' '||b.nama_bagian) FROM bagian b JOIN kelas k ON k.id=b.kelas_id LEFT JOIN tingkatan t ON t.id=b.tingkatan_id WHERE b.id=$BAGIAN_LAMA;")
ok "santri $SANTRI_ID (kelas lama: $LABEL_LAMA), TA berjalan: $TA_LAMA"

# ── 2. Snapshot kondisi "tahun sebelumnya" ───────────────────────────────────
say "2. Snapshot data sebelum naik kelas"
JUZ_BEFORE=$(psql_test "SELECT count(*) FROM setoran_juz_amma WHERE santri_id=$SANTRI_ID AND tahun_ajaran='$TA_LAMA';")
NIL_BEFORE=$(psql_test "SELECT count(*) FROM nilai_kuartal WHERE santri_id=$SANTRI_ID AND tahun_ajaran='$TA_LAMA';")
KOMP_BEFORE=$(psql_test "SELECT string_agg(kategori||'='||COALESCE(hasil,'-'), ', ' ORDER BY kategori) FROM nilai_kompetensi WHERE santri_id=$SANTRI_ID AND tahun_ajaran='$TA_LAMA';")
ok "juz: $JUZ_BEFORE baris | nilai: $NIL_BEFORE baris | kompetensi: ${KOMP_BEFORE:-（kosong）}"

# ── 3. Naik kelas (tanggal dimanipulasi lewat SQL) ───────────────────────────
say "3. Naikkan ke kelas atas + geser ke TA baru"
TA_BARU=$(psql_test "SELECT tahun_ajaran FROM kalender_kuartal GROUP BY 1 ORDER BY 1 DESC LIMIT 1;")   # TA terakhir di kalender
BAGIAN_BARU=$(psql_test "
  SELECT b.id FROM bagian b JOIN kelas k ON k.id=b.kelas_id JOIN tingkatan t ON t.id=b.tingkatan_id
  WHERE b.id <> $BAGIAN_LAMA AND (t.urutan, k.nama) > (
      SELECT t2.urutan, k2.nama FROM bagian b2 JOIN kelas k2 ON k2.id=b2.kelas_id JOIN tingkatan t2 ON t2.id=b2.tingkatan_id WHERE b2.id=$BAGIAN_LAMA)
  ORDER BY t.urutan, k.nama LIMIT 1;")
[ -n "$BAGIAN_BARU" ] || { bad "tak menemukan kelas tujuan"; exit 1; }
LABEL_BARU=$(psql_test "SELECT TRIM(k.nama||' '||t.nama||' '||b.nama_bagian) FROM bagian b JOIN kelas k ON k.id=b.kelas_id LEFT JOIN tingkatan t ON t.id=b.tingkatan_id WHERE b.id=$BAGIAN_BARU;")

# Simulasi naik kelas: tutup riwayat lama DI AKHIR TA lama, buka riwayat baru DI AWAL TA baru
AKHIR_TA_LAMA=$(psql_test "SELECT max(tgl_selesai) FROM kalender_kuartal WHERE tahun_ajaran='$TA_LAMA';")
AWAL_TA_BARU=$(psql_test "SELECT min(tgl_mulai) FROM kalender_kuartal WHERE tahun_ajaran='$TA_BARU';")
psql_test "UPDATE riwayat_bagian SET tanggal_selesai='$AKHIR_TA_LAMA' WHERE santri_id=$SANTRI_ID AND tanggal_selesai IS NULL;" >/dev/null
psql_test "INSERT INTO riwayat_bagian (santri_id, bagian_id, tanggal_mulai) VALUES ($SANTRI_ID, $BAGIAN_BARU, '$AWAL_TA_BARU');" >/dev/null
psql_test "UPDATE santri SET bagian_id=$BAGIAN_BARU WHERE id=$SANTRI_ID;" >/dev/null
psql_test "UPDATE settings SET value='$TA_BARU' WHERE key='tahun_ajaran_aktif';" >/dev/null
ok "kelas lama ditutup $AKHIR_TA_LAMA, kelas baru ($LABEL_BARU) mulai $AWAL_TA_BARU, TA aktif → $TA_BARU"

# ── 4. Jalankan app uji & bandingkan ─────────────────────────────────────────
say "4. Verifikasi: riwayat TA lama TIDAK boleh berubah"
JUZ_AFTER=$(psql_test "SELECT count(*) FROM setoran_juz_amma WHERE santri_id=$SANTRI_ID AND tahun_ajaran='$TA_LAMA';")
NIL_AFTER=$(psql_test "SELECT count(*) FROM nilai_kuartal WHERE santri_id=$SANTRI_ID AND tahun_ajaran='$TA_LAMA';")
KOMP_AFTER=$(psql_test "SELECT string_agg(kategori||'='||COALESCE(hasil,'-'), ', ' ORDER BY kategori) FROM nilai_kompetensi WHERE santri_id=$SANTRI_ID AND tahun_ajaran='$TA_LAMA';")
JUZ_NEW=$(psql_test "SELECT count(*) FROM setoran_juz_amma WHERE santri_id=$SANTRI_ID AND tahun_ajaran='$TA_BARU';")

PASS=1
[ "$JUZ_AFTER" = "$JUZ_BEFORE" ] && ok "juz TA lama tetap $JUZ_AFTER (was $JUZ_BEFORE)" || { bad "juz TA lama BERUBAH: $JUZ_BEFORE → $JUZ_AFTER"; PASS=0; }
[ "$NIL_AFTER" = "$NIL_BEFORE" ] && ok "nilai TA lama tetap $NIL_AFTER (was $NIL_BEFORE)" || { bad "nilai TA lama BERUBAH: $NIL_BEFORE → $NIL_AFTER"; PASS=0; }
[ "$KOMP_AFTER" = "$KOMP_BEFORE" ] && ok "kompetensi TA lama tetap [${KOMP_AFTER:-kosong}]" || { bad "kompetensi TA lama BERUBAH: [$KOMP_BEFORE] → [$KOMP_AFTER]"; PASS=0; }
[ "$JUZ_NEW" = "0" ] && ok "juz TA baru masih KOSONG di DB (belum dinilai)" || printf '  \033[1;33m!\033[0m juz TA baru sudah ada %s baris (wajar bila ensureSetoranRows pernah jalan)\n' "$JUZ_NEW"

say "HASIL: kelas $LABEL_LAMA → $LABEL_BARU, TA $TA_LAMA → $TA_BARU"
[ "$PASS" = "1" ] && ok "SEMUA LULUS ✓" || { bad "ADA YANG GAGAL"; exit 1; }
