#!/bin/bash
# Uji alur admin landing CMS: login -> CRUD (dengan CSRF) -> render.
cd /opt/simmubtadiat
U=$(sudo grep -E '^SEED_ADMIN_USERNAME=' .env | cut -d= -f2- | tr -d '"')
P=$(sudo grep -E '^SEED_ADMIN_PASSWORD=' .env | cut -d= -f2- | tr -d '"')
[ -n "$U" ] && [ -n "$P" ] || { echo "GAGAL baca kredensial .env"; exit 1; }

echo "== login =="
curl -s -c /tmp/adm.txt -o /dev/null -w "login -> %{http_code}\n" -X POST http://127.0.0.1:8090/api/login \
  -H "Content-Type: application/json" \
  --data-binary "{\"username\":\"$U\",\"password\":\"$P\"}"
CSRF=$(grep csrf_token /tmp/adm.txt | awk '{print $NF}')
[ -n "$CSRF" ] || { echo "GAGAL: csrf_token tidak ada di cookie jar"; exit 1; }
H_CSRF="X-CSRF-Token: $CSRF"

echo "== PUT settings =="
curl -s -b /tmp/adm.txt -H "$H_CSRF" -X PUT http://127.0.0.1:8090/api/landing/admin/settings \
  -H "Content-Type: application/json" \
  --data-binary '{"site_tagline":"Uji coba CMS landing — diedit via API"}' \
  -o /dev/null -w "PUT settings -> %{http_code}\n"
curl -s http://127.0.0.1:8090/landing | grep -oE "Uji coba CMS landing[^<]*" | head -1

echo "== PUT section 1 (konten uji) =="
curl -s -b /tmp/adm.txt -H "$H_CSRF" -X PUT http://127.0.0.1:8090/api/landing/admin/sections/1 \
  -H "Content-Type: application/json" \
  --data-binary '{"slug":"sejarah","judul":"Profil & Sejarah","konten_html":"<h2>Uji Coba</h2><p>Konten diedit via API admin.</p>","is_published":true,"tampil_di_menu":true,"urutan":1}' \
  -o /dev/null -w "PUT section -> %{http_code}\n"
curl -s http://127.0.0.1:8090/p/sejarah | grep -oE "Konten diedit via API admin" | head -1

echo "== POST section baru (galeri) =="
curl -s -b /tmp/adm.txt -H "$H_CSRF" -X POST http://127.0.0.1:8090/api/landing/admin/sections \
  -H "Content-Type: application/json" \
  --data-binary '{"slug":"galeri","subdomain":"galeri","judul":"Galeri","konten_html":"<p>Galeri foto pesantren.</p>","is_published":true,"tampil_di_menu":true,"urutan":7}' \
  -o /dev/null -w "POST section -> %{http_code}\n"
curl -s -o /dev/null -w "https://galeri.reviewtechno.me -> %{http_code}\n" --max-time 15 https://galeri.reviewtechno.me/

echo "== DELETE section galeri (bersihkan) =="
GID=$(curl -s -b /tmp/adm.txt http://127.0.0.1:8090/api/landing/admin/sections | jq -r '.[] | select(.slug=="galeri") | .id')
curl -s -b /tmp/adm.txt -H "$H_CSRF" -X DELETE http://127.0.0.1:8090/api/landing/admin/sections/$GID -o /dev/null -w "DELETE section -> %{http_code}\n"
curl -s -o /dev/null -w "galeri setelah hapus -> %{http_code}\n" --max-time 15 https://galeri.reviewtechno.me/

rm -f /tmp/adm.txt
