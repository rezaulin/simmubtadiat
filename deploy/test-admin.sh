#!/bin/bash
# Uji alur admin landing CMS: login -> CRUD (CSRF) -> restore state awal.
# Jalankan sebagai user rezaahzani (baca .env 600):  bash deploy/test-admin.sh
# Exit code != 0 bila ada langkah gagal.
set -u
cd /opt/simmubtadiat || exit 1

K_USER="SEED_ADMIN_""USERNAME"
K_PASS="SEED_ADMIN_""PASSWORD"
U=$(grep -E "^${K_USER}=" .env | cut -d= -f2- | tr -d '"')
P=$(grep -E "^${K_PASS}=" .env | cut -d= -f2- | tr -d '"')
[ -n "$U" ] && [ -n "$P" ] || { echo "GAGAL baca kredensial .env"; exit 1; }

BASE=http://127.0.0.1:8090
J=/tmp/lp-adm.txt
fail=0
ok()  { echo "  OK   $1"; }
bad() { echo "  FAIL $1"; fail=1; }
chk() { [ "$1" = "$2" ] && ok "$3 ($1)" || bad "$3 (dapat $1, harap $2)"; }

echo "== login =="
code=$(curl -s -c "$J" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/login" \
  -H 'Content-Type: application/json' \
  --data-binary "{\"username\":\"$U\",\"password\":\"$P\"}")
chk "$code" 200 "login"
[ "$fail" = 0 ] || { echo "GAGAL login — hentikan"; rm -f "$J"; exit 1; }
CSRF=$(grep csrf_token "$J" | awk '{print $NF}')
[ -n "$CSRF" ] || { echo "GAGAL: csrf_token tidak ada di cookie jar"; rm -f "$J"; exit 1; }
H="X-CSRF-Token: $CSRF"

echo "== simpan state awal (buat restore) =="
S1=$(curl -s -b "$J" "$BASE/api/landing/admin/sections" | jq -c '.[] | select(.slug=="sejarah")')
TAG0=$(curl -s "$BASE/api/landing/settings" | jq -r '.[] | select(.key=="site_tagline") | .value')
[ -n "$S1" ] || { echo "GAGAL: section sejarah tidak ada"; rm -f "$J"; exit 1; }
SUB0=$(echo "$S1" | jq -r '.subdomain // ""')
echo "  section sejarah id=$(echo "$S1" | jq -r '.id') subdomain='${SUB0:-<null>}' tagline='$TAG0'"

echo "== PUT settings =="
code=$(curl -s -b "$J" -H "$H" -X PUT "$BASE/api/landing/admin/settings" \
  -H 'Content-Type: application/json' \
  --data-binary '{"site_tagline":"Uji coba CMS landing — diedit via API"}' \
  -o /dev/null -w '%{http_code}')
chk "$code" 200 "PUT settings"
curl -s "$BASE/landing" | grep -q "Uji coba CMS landing" && ok "tagline tampil di /landing" || bad "tagline tidak tampil di /landing"

echo "== PUT section sejarah (FULL payload, subdomain disertakan) =="
ID1=$(echo "$S1" | jq -r '.id')
payload=$(echo "$S1" | jq -c '{slug:.slug, subdomain:.subdomain, judul:.judul,
  konten_html:"<h2>Uji Coba</h2><p>Konten diedit via API admin.</p>",
  meta_title:.meta_title, meta_description:.meta_description, og_image:.og_image,
  urutan:.urutan, tampil_di_menu:.tampil_di_menu, is_published:.is_published}')
code=$(curl -s -b "$J" -H "$H" -X PUT "$BASE/api/landing/admin/sections/$ID1" \
  -H 'Content-Type: application/json' --data-binary "$payload" -o /dev/null -w '%{http_code}')
chk "$code" 200 "PUT section"
curl -s "$BASE/p/sejarah" | grep -q "Konten diedit via API admin" && ok "konten tampil di /p/sejarah" || bad "konten tidak tampil di /p/sejarah"
if [ -n "$SUB0" ]; then
  curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$SUB0.reviewtechno.me/" > /tmp/lp-sub.txt
  chk "$(cat /tmp/lp-sub.txt)" 200 "subdomain $SUB0 tetap hidup"
fi

echo "== POST section baru (uji-crud) =="
code=$(curl -s -b "$J" -H "$H" -X POST "$BASE/api/landing/admin/sections" \
  -H 'Content-Type: application/json' \
  --data-binary '{"slug":"uji-crud","subdomain":"uji-crud","judul":"Uji CRUD","konten_html":"<p>Halaman uji.</p>","urutan":99,"tampil_di_menu":false,"is_published":true}' \
  -o /dev/null -w '%{http_code}')
chk "$code" 200 "POST section"
curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://uji-crud.reviewtechno.me/" > /tmp/lp-sub.txt
chk "$(cat /tmp/lp-sub.txt)" 200 "subdomain uji-crud langsung hidup"

echo "== DELETE section uji-crud =="
GID=$(curl -s -b "$J" "$BASE/api/landing/admin/sections" | jq -r '.[] | select(.slug=="uji-crud") | .id')
code=$(curl -s -b "$J" -H "$H" -X DELETE "$BASE/api/landing/admin/sections/$GID" -o /dev/null -w '%{http_code}')
chk "$code" 200 "DELETE section"
curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://uji-crud.reviewtechno.me/" > /tmp/lp-sub.txt
chk "$(cat /tmp/lp-sub.txt)" 404 "subdomain uji-crud 404 setelah hapus"

echo "== restore state awal =="
restore=$(echo "$S1" | jq -c '{slug:.slug, subdomain:.subdomain, judul:.judul, konten_html:.konten_html,
  meta_title:.meta_title, meta_description:.meta_description, og_image:.og_image,
  urutan:.urutan, tampil_di_menu:.tampil_di_menu, is_published:.is_published}')
code=$(curl -s -b "$J" -H "$H" -X PUT "$BASE/api/landing/admin/sections/$ID1" \
  -H 'Content-Type: application/json' --data-binary "$restore" -o /dev/null -w '%{http_code}')
chk "$code" 200 "restore section"
curl -s -b "$J" -H "$H" -X PUT "$BASE/api/landing/admin/settings" \
  -H 'Content-Type: application/json' \
  --data-binary "$(jq -cn --arg v "$TAG0" '{site_tagline:$v}')" -o /dev/null -w '%{http_code}' > /tmp/lp-code.txt
chk "$(cat /tmp/lp-code.txt)" 200 "restore tagline"
curl -s "$BASE/landing" | grep -q "Uji coba CMS landing" && bad "tagline uji masih tampil" || ok "tagline uji sudah bersih"
if [ -n "$SUB0" ]; then
  curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$SUB0.reviewtechno.me/" > /tmp/lp-sub.txt
  chk "$(cat /tmp/lp-sub.txt)" 200 "subdomain $SUB0 tetap hidup setelah restore"
fi

rm -f "$J" /tmp/lp-sub.txt /tmp/lp-code.txt
echo
if [ "$fail" = 0 ]; then echo "HASIL: SEMUA LANGKAH LOLOS"; else echo "HASIL: ADA LANGKAH GAGAL"; fi
exit "$fail"
