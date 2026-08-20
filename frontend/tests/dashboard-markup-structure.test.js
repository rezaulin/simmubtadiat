// Feature: dashboard-redesign-kalender, Task 6.2: Struktur & tata letak markup Dashboard
// Validates: Requirements 2.7, 2.8, 3.1, 3.5, 3.6, 2.9
//
// Ini adalah example-based STRUCTURAL/DOM tests (BUKAN property tests). Test ini
// membaca markup statis `frontend/index.html` dari disk, mem-parse-nya dengan
// jsdom, lalu memverifikasi struktur & tata letak Dashboard hasil redesign:
//
//   - Urutan kolom desktop (2.7): kolom kiri (#dash-charts, lg:col-span-2) memuat
//     #chart-tingkatan lalu #chart-status, dan berada sebelum kolom kanan.
//   - Kolom kanan (2.8): #dash-side memuat #quick-actions, #widget-kalender
//     (Kalender_Agenda), lalu #ringkasan-pengajar secara berurutan.
//   - Ponsel (3.1): area konten berlapis satu kolom pada base (grid-cols-1;
//     multi-kolom hanya pada breakpoint lg), dan Header_Hero (#dash-hero) memiliki
//     sudut membulat ≥16px pada keempat sudut (rounded-[2rem] = 32px).
//   - Padding bawah (3.6): <main> memberi jarak bawah ≥ tinggi Bottom_Nav (pb-24).
//   - Bottom_Nav (3.5): blok Bottom_Nav + FAB index.html identik-ternormalisasi
//     dengan blok kanonik pada halaman lain (santri.html).
//   - Tanpa pustaka chart (2.9): index.html & main.js TIDAK mengimpor/memuat
//     pustaka chart pihak ketiga.
//
// Pola pemuatan halaman mengikuti nav-structure.test.js / static-markup-scan.test.js:
// resolve terhadap process.cwd() (Vitest menjalankan suite dengan cwd = frontend/).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

function pagePath(name) {
  return resolve(process.cwd(), name);
}

function readPage(name) {
  return readFileSync(pagePath(name), 'utf8');
}

function loadDoc(name) {
  return new JSDOM(readPage(name)).window.document;
}

function readSrc(relPath) {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8');
}

// Index posisi elemen anak (berdasarkan id) di dalam sebuah kontainer, mengikuti
// urutan kemunculan pada DOM. -1 bila tidak ditemukan.
function childIndexById(container, id) {
  const el = container.querySelector('#' + id);
  if (!el) return -1;
  const all = [...container.querySelectorAll('[id]')];
  return all.indexOf(el);
}

// --- helper radius: konversi rounded-[...] / rounded-{name} menjadi px minimum -

const NAMED_RADIUS_PX = {
  'rounded-none': 0,
  'rounded-sm': 2,
  rounded: 4,
  'rounded-md': 6,
  'rounded-lg': 8,
  'rounded-xl': 12,
  'rounded-2xl': 16,
  'rounded-3xl': 24,
  'rounded-full': 9999,
};

// Konversi nilai arbitrary Tailwind (mis. '2rem', '16px') → px. rem diasumsikan
// 16px (root font-size default). Return null bila tidak dapat diurai.
function arbitraryRadiusToPx(value) {
  const m = /^([0-9.]+)(px|rem)$/.exec(value.trim());
  if (!m) return null;
  const num = parseFloat(m[1]);
  return m[2] === 'rem' ? num * 16 : num;
}

// Radius sudut (px) yang berlaku pada seluruh empat sudut sebuah elemen,
// dihitung dari token kelas `rounded-*` (tanpa varian sisi/sudut spesifik).
// Return radius terkecil yang berlaku untuk keempat sudut, atau null bila tak ada.
function fourCornerRadiusPx(el) {
  const tokens = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  let best = null;
  for (const tok of tokens) {
    // Abaikan varian responsif/state; hanya token rounded polos untuk keempat sudut.
    if (tok.includes(':')) continue;
    // Abaikan rounded sisi/sudut spesifik (rounded-t-*, rounded-l-*, rounded-tl-*, ...).
    if (/^rounded-(t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee)(-|$)/.test(tok)) continue;

    const arb = /^rounded-\[(.+)\]$/.exec(tok);
    if (arb) {
      const px = arbitraryRadiusToPx(arb[1]);
      if (px != null) best = best == null ? px : Math.min(best, px);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(NAMED_RADIUS_PX, tok)) {
      const px = NAMED_RADIUS_PX[tok];
      best = best == null ? px : Math.min(best, px);
    }
  }
  return best;
}

// --- Bottom_Nav signature (selaras dengan nav-structure.test.js) --------------

function findBottomNav(doc) {
  return [...doc.querySelectorAll('nav')].find(
    (nav) =>
      nav.classList.contains('md:hidden') &&
      nav.classList.contains('fixed') &&
      nav.classList.contains('bottom-0')
  );
}

function bottomNavSignature(nav) {
  const anchors = [...nav.querySelectorAll('a[data-nav]')].map((a) => {
    const icon = a.querySelector('i[data-lucide]');
    const label = a.querySelector('span');
    return {
      href: a.getAttribute('href'),
      dataNav: a.hasAttribute('data-nav'),
      icon: icon ? icon.getAttribute('data-lucide') : null,
      label: label ? label.textContent.replace(/\s+/g, ' ').trim() : null,
    };
  });
  const fabBtn = nav.querySelector('#btn-mobile-search');
  const fabIcon = fabBtn ? fabBtn.querySelector('i[data-lucide]') : null;
  const fab = fabBtn
    ? {
        id: fabBtn.id,
        ariaLabel: fabBtn.getAttribute('aria-label'),
        icon: fabIcon ? fabIcon.getAttribute('data-lucide') : null,
      }
    : null;
  return { anchors, fab };
}

// --- 1. Urutan kolom desktop (Req 2.7, 2.8) ----------------------------------

describe('urutan & isi kolom Dashboard desktop (Req 2.7, 2.8)', () => {
  const doc = loadDoc('index.html');

  it('kolom kiri (#dash-charts) memuat #chart-tingkatan sebelum #chart-status (Req 2.7)', () => {
    const charts = doc.querySelector('#dash-charts');
    expect(charts, 'expected #dash-charts left column').toBeTruthy();

    const iTingkatan = childIndexById(charts, 'chart-tingkatan');
    const iStatus = childIndexById(charts, 'chart-status');
    expect(iTingkatan, '#chart-tingkatan must exist in #dash-charts').toBeGreaterThanOrEqual(0);
    expect(iStatus, '#chart-status must exist in #dash-charts').toBeGreaterThanOrEqual(0);
    expect(iTingkatan).toBeLessThan(iStatus);
  });

  it('#dash-charts adalah kolom kiri dua-lebar (lg:col-span-2) (Req 2.7)', () => {
    const charts = doc.querySelector('#dash-charts');
    expect(charts.classList.contains('lg:col-span-2')).toBe(true);
  });

  it('kolom kanan (#dash-side) memuat quick-actions → widget-kalender → ringkasan-pengajar (Req 2.8)', () => {
    const side = doc.querySelector('#dash-side');
    expect(side, 'expected #dash-side right column').toBeTruthy();

    const iQuick = childIndexById(side, 'quick-actions');
    const iKalender = childIndexById(side, 'widget-kalender');
    const iRingkasan = childIndexById(side, 'ringkasan-pengajar');

    expect(iQuick, '#quick-actions ("Akses Cepat") must exist').toBeGreaterThanOrEqual(0);
    expect(iKalender, '#widget-kalender (Kalender_Agenda) must exist').toBeGreaterThanOrEqual(0);
    expect(iRingkasan, '#ringkasan-pengajar ("Ringkasan Pengajar") must exist').toBeGreaterThanOrEqual(0);

    expect(iQuick).toBeLessThan(iKalender);
    expect(iKalender).toBeLessThan(iRingkasan);
  });

  it('kolom kiri (#dash-charts) berada sebelum kolom kanan (#dash-side) pada DOM (Req 2.7, 2.8)', () => {
    const charts = doc.querySelector('#dash-charts');
    const side = doc.querySelector('#dash-side');
    const pos = charts.compareDocumentPosition(side);
    // DOCUMENT_POSITION_FOLLOWING (4): side mengikuti charts → charts lebih dulu.
    expect(pos & doc.defaultView.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('kolom kiri & kanan berbagi kontainer grid dua-kolom yang sama (Req 2.7, 2.8)', () => {
    const charts = doc.querySelector('#dash-charts');
    const side = doc.querySelector('#dash-side');
    expect(charts.parentElement).toBe(side.parentElement);
    expect(charts.parentElement.classList.contains('lg:grid-cols-3')).toBe(true);
  });
});

// --- 2. Tata letak ponsel: satu kolom + radius hero (Req 3.1) -----------------

describe('tata letak Dashboard ponsel: satu kolom & radius hero (Req 3.1)', () => {
  const doc = loadDoc('index.html');

  it('area dua kolom bertumpuk satu kolom pada base (grid-cols-1), multi-kolom hanya di lg', () => {
    const charts = doc.querySelector('#dash-charts');
    const grid = charts.parentElement;
    expect(grid.classList.contains('grid')).toBe(true);
    // Base (Viewport_Mobile) = satu kolom.
    expect(grid.classList.contains('grid-cols-1')).toBe(true);
    // Multi-kolom hanya pada breakpoint lg (bukan md/sm), sehingga ponsel tetap 1 kolom.
    const multiCol = [...grid.classList].filter((c) => /(^|:)grid-cols-[2-9]/.test(c));
    expect(multiCol.every((c) => c.startsWith('lg:'))).toBe(true);
  });

  it('Header_Hero (#dash-hero) memiliki sudut membulat ≥16px pada keempat sudut', () => {
    const hero = doc.querySelector('#dash-hero');
    expect(hero, 'expected #dash-hero').toBeTruthy();
    const radius = fourCornerRadiusPx(hero);
    expect(radius, '#dash-hero must declare a four-corner rounded-* class').not.toBeNull();
    expect(radius).toBeGreaterThanOrEqual(16);
  });
});

// --- 3. Padding bawah ≥ tinggi Bottom_Nav (Req 3.6) --------------------------

describe('padding bawah konten utama ≥ tinggi Bottom_Nav (Req 3.6)', () => {
  const doc = loadDoc('index.html');

  it('<main> memakai pb-24 (96px) pada base, cukup untuk menaungi Bottom_Nav', () => {
    const main = doc.querySelector('main');
    expect(main, 'expected <main>').toBeTruthy();
    const cls = main.classList;
    // pb-24 = 6rem = 96px ≥ tinggi Bottom_Nav (nav h-14 = 56px + padding).
    expect(cls.contains('pb-24')).toBe(true);
  });
});

// --- 4. Bottom_Nav identik dengan kanonik (Req 3.5) --------------------------

describe('Bottom_Nav Dashboard identik-ternormalisasi dengan halaman kanonik (Req 3.5)', () => {
  it('signature Bottom_Nav index.html === santri.html (blok kanonik)', () => {
    const indexNav = findBottomNav(loadDoc('index.html'));
    const canonicalNav = findBottomNav(loadDoc('santri.html'));
    expect(indexNav, 'expected Bottom_Nav on index.html').toBeTruthy();
    expect(canonicalNav, 'expected Bottom_Nav on santri.html').toBeTruthy();
    expect(bottomNavSignature(indexNav)).toEqual(bottomNavSignature(canonicalNav));
  });

  it('index.html memuat FAB #btn-mobile-search di dalam Bottom_Nav', () => {
    const indexNav = findBottomNav(loadDoc('index.html'));
    expect(indexNav.querySelector('#btn-mobile-search')).toBeTruthy();
  });
});

// --- 5. Tanpa pustaka chart pihak ketiga (Req 2.9) ---------------------------

describe('Dashboard tidak mengimpor/memuat pustaka chart pihak ketiga (Req 2.9)', () => {
  // Nama pustaka chart populer yang harus TIDAK ada di markup/skrip dashboard.
  const CHART_LIBS = [
    'chart.js', 'chartjs', 'chart.min.js',
    'apexcharts', 'echarts', 'highcharts', 'plotly',
    'recharts', 'chartist', 'britecharts', 'frappe-charts', 'billboard.js',
    'amcharts', 'nvd3', 'c3.js', 'd3.js', 'd3.min.js',
  ];

  it('index.html tidak memuat <script>/<link> pustaka chart', () => {
    const html = readPage('index.html').toLowerCase();
    const doc = loadDoc('index.html');

    // Cek atribut src <script> dan href <link> secara terstruktur.
    const urls = [
      ...[...doc.querySelectorAll('script[src]')].map((s) => s.getAttribute('src') || ''),
      ...[...doc.querySelectorAll('link[href]')].map((l) => l.getAttribute('href') || ''),
    ].map((u) => u.toLowerCase());

    for (const lib of CHART_LIBS) {
      expect(
        urls.some((u) => u.includes(lib)),
        `index.html must not load chart lib "${lib}"`
      ).toBe(false);
      // Pemindaian teks tambahan (mis. import dinamis / komentar CDN).
      expect(
        html.includes(lib),
        `index.html markup must not reference chart lib "${lib}"`
      ).toBe(false);
    }
  });

  it('main.js tidak mengimpor pustaka chart', () => {
    const js = readSrc('src/js/main.js').toLowerCase();
    for (const lib of CHART_LIBS) {
      expect(js.includes(lib), `main.js must not import chart lib "${lib}"`).toBe(false);
    }
    // Tidak ada statement import yang menyebut "chart" sebagai modul pihak ketiga.
    const importChart = /import[^;]*from\s*['"][^'"]*chart[^'"]*['"]/i.test(js);
    expect(importChart, 'main.js must not import a chart module').toBe(false);
  });
});
