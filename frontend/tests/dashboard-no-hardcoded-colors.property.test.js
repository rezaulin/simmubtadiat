// Feature: dashboard-redesign-kalender, Property 1: Tidak ada warna primer/hero yang di-hardcode di HTML
// Validates: Requirements 1.5
//
// Untuk setiap berkas HTML tercakup di `frontend/`, isi berkas TIDAK memuat nilai
// heksadesimal warna primer/hero yang dilarang (#2B5BDB, #0E7C86, #0F6E77, #12A2A8)
// sebagai gaya langsung; seluruh warna primer, hover, hero gradient, background, dan
// aksen harus dirujuk melalui token `@theme` di `frontend/style.css`.
//
// Catatan cakupan (dari requirements.md "Non-Tujuan"): file preview sementara
// (palette-preview.html, dashboard-preview.html, mobile-preview.html) BUKAN
// deliverable dan dikecualikan. node_modules juga tidak dipindai.
//
// Catatan pengecualian `theme-color`: nilai `<meta name="theme-color" content="...">`
// adalah konfigurasi chrome browser (warna bilah alamat) yang menurut batasan
// platform TIDAK dapat merujuk token CSS. Ini bukan "gaya langsung" pada elemen
// (style attribute / <style> / kelas utilitas warna), sehingga dikecualikan dari
// pemindaian sebelum memeriksa hex terlarang. Requirement 1.5 menyasar hex yang
// dipakai sebagai gaya langsung.
//
// Resolusi path memakai process.cwd() (Vitest menjalankan suite frontend dengan
// cwd di `frontend/`). Kita hindari import.meta.url + fileURLToPath karena di
// lingkungan jsdom, global `URL` adalah implementasi jsdom yang ditolak oleh
// node:url fileURLToPath.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';

const FRONTEND_DIR = process.cwd();

// File preview sementara yang bukan bagian deliverable (out of scope).
const EXCLUDED_HTML = new Set([
  'palette-preview.html',
  'dashboard-preview.html',
  'mobile-preview.html',
]);

// Nilai heksadesimal warna primer/hero yang dilarang di-hardcode sebagai gaya
// langsung (case-insensitive).
const FORBIDDEN_HEX = ['#2B5BDB', '#0E7C86', '#0F6E77', '#12A2A8'];

// Kumpulkan seluruh berkas HTML tercakup di frontend/ (kecuali file preview).
// node_modules tidak berada di root frontend/ sehingga tidak terpindai.
const COVERED_HTML = readdirSync(FRONTEND_DIR)
  .filter((name) => name.endsWith('.html'))
  .filter((name) => !EXCLUDED_HTML.has(name))
  .sort();

// Hapus tag <meta ... theme-color ...> (chrome browser config) sebelum
// memindai gaya langsung. Menghapus seluruh tag <meta> yang menyebut
// theme-color menghilangkan nilai content-nya dari pemindaian.
function stripThemeColorMeta(html) {
  return html.replace(/<meta\b[^>]*theme-color[^>]*>/gi, '');
}

// Pindai isi berkas untuk hex terlarang setelah mengecualikan meta theme-color.
// Return daftar hex terlarang yang ditemukan sebagai gaya langsung.
function findForbiddenHex(rawHtml) {
  const scannable = stripThemeColorMeta(rawHtml);
  const upper = scannable.toUpperCase();
  return FORBIDDEN_HEX.filter((hex) => upper.includes(hex.toUpperCase()));
}

// Pra-baca isi tiap berkas sekali agar properti hanya menguji logika pemindaian.
const HTML_CONTENT = Object.fromEntries(
  COVERED_HTML.map((name) => [name, readFileSync(resolve(FRONTEND_DIR, name), 'utf8')])
);

describe('Property 1: no hardcoded primary/hero hex colors in covered HTML files', () => {
  it('discovers at least one covered HTML file (sanity)', () => {
    expect(COVERED_HTML.length).toBeGreaterThan(0);
  });

  it('every covered HTML file references @theme tokens, not forbidden primary/hero hex (excluding meta theme-color)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...COVERED_HTML), (file) => {
        const html = HTML_CONTENT[file];
        const offenders = findForbiddenHex(html);
        expect(
          offenders,
          `${file}: hardcoded primary/hero hex used as direct styling: ${offenders.join(', ')}. ` +
            `Warna primer/hover/hero/background/aksen harus merujuk token @theme, bukan nilai hex langsung.`
        ).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });
});
