// Feature: dashboard-redesign-kalender, Property 13: Deep-link absensi round-trip dan validasi query
// Untuk setiap bagian_id dan tanggal, buildAbsensiDeepLink (main.js) menghasilkan
// URL berformat `absensi.html?bagian=<bagian_id>&tanggal=<YYYY-MM-DD>`, dan
// parseAbsensiQuery (absensi.js) atas URL tersebut mengembalikan valid=true dengan
// bagian & tanggal yang sama (round-trip). Untuk setiap query dengan bagian
// hilang/non-numerik atau tanggal hilang/tidak sesuai format kalender valid,
// parseAbsensiQuery mengembalikan valid=false.
// Validates: Requirements 5.5, 5.7

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// Baik main.js maupun absensi.js memiliki efek samping di top-level: keduanya
// membaca window.matchMedia (untuk dark mode), memanggil getElementById pada
// banyak elemen, memasang addEventListener, dan menjalankan init()/checkAuth()
// yang memanggil fetch('/api/me'). Sediakan elemen DOM yang dibutuhkan serta
// stub window.matchMedia dan fetch SEBELUM dynamic import agar impor tidak
// melempar error. Pola ini mengikuti khidmah-riwayat-status.property.test.js.
let buildAbsensiDeepLink;
let parseAbsensiQuery;

beforeAll(async () => {
  document.body.innerHTML = `
    <select id="filter-kelas"></select>
    <select id="filter-bagian"></select>
    <input id="filter-tanggal" />
    <button id="btn-load"></button>
    <div id="table-container"></div>
    <div id="empty-state"></div>
    <tbody id="table-body"></tbody>
    <button id="btn-save-bulk"></button>
  `;

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    });
  }

  // checkAuth()/init() memanggil fetch('/api/me'); tolak agar keduanya masuk
  // blok catch tanpa mencoba navigasi (window.location) di jsdom.
  globalThis.fetch = () => Promise.reject(new Error('stubbed fetch'));

  const [mainMod, absensiMod] = await Promise.all([
    import('../src/js/main.js'),
    import('../src/js/absensi.js'),
  ]);
  buildAbsensiDeepLink = mainMod.buildAbsensiDeepLink;
  parseAbsensiQuery = absensiMod.parseAbsensiQuery;
});

// Generator: bagian_id numerik (sebagai string, seperti yang dibaca dari query).
const bagianIdArb = fc.nat({ max: 1_000_000 }).map((n) => String(n));

// Generator: Date valid dalam rentang wajar (dipakai buildAbsensiDeepLink).
const dateArb = fc
  .date({ min: new Date('2000-01-01T00:00:00'), max: new Date('2100-12-31T00:00:00') })
  .filter((d) => !Number.isNaN(d.getTime()));

describe('Property 13: Deep-link absensi round-trip dan validasi query', () => {
  it('round-trip: parseAbsensiQuery(buildAbsensiDeepLink(bagian, date)) valid dengan nilai yang sama', () => {
    fc.assert(
      fc.property(bagianIdArb, dateArb, (bagianId, date) => {
        const url = buildAbsensiDeepLink(bagianId, date);

        // Format URL sesuai kontrak.
        expect(url.startsWith('absensi.html?')).toBe(true);
        const parsed = parseAbsensiQuery(url);

        expect(parsed.valid).toBe(true);
        expect(parsed.bagian).toBe(bagianId);
        // tanggal yang di-parse harus round-trip ke YYYY-MM-DD yang dibangun.
        const expectedTanggal = url.split('tanggal=')[1];
        expect(parsed.tanggal).toBe(expectedTanggal);
        expect(/^\d{4}-\d{2}-\d{2}$/.test(parsed.tanggal)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('invalid: bagian hilang atau non-numerik → valid=false', () => {
    // tanggal valid, tetapi bagian bermasalah.
    const badBagianArb = fc.oneof(
      fc.constant(null), // bagian tidak ada
      fc.string().filter((s) => !/^\d+$/.test(s)), // non-numerik (termasuk kosong)
      fc.constant('12a'),
      fc.constant('-5'),
      fc.constant('1.5')
    );

    fc.assert(
      fc.property(badBagianArb, dateArb, (badBagian, date) => {
        const tanggal = buildAbsensiDeepLink('1', date).split('tanggal=')[1];
        const params = new URLSearchParams();
        if (badBagian !== null) params.set('bagian', badBagian);
        params.set('tanggal', tanggal);
        const search = `absensi.html?${params.toString()}`;

        expect(parseAbsensiQuery(search).valid).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('invalid: tanggal hilang, malformed, atau bukan tanggal kalender nyata → valid=false', () => {
    const badTanggalArb = fc.oneof(
      fc.constant(null), // tanggal tidak ada
      fc.constant('2024-2-3'), // tidak zero-padded
      fc.constant('2024/02/03'), // separator salah
      fc.constant('20240203'), // tanpa separator
      fc.constant('2024-13-01'), // bulan tidak valid
      fc.constant('2024-00-10'), // bulan 0
      fc.constant('2024-02-30'), // hari tidak ada di Februari
      fc.constant('2023-02-29'), // 2023 bukan kabisat
      fc.constant('2024-04-31'), // April hanya 30 hari
      fc.string().filter((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s))
    );

    fc.assert(
      fc.property(bagianIdArb, badTanggalArb, (bagianId, badTanggal) => {
        const params = new URLSearchParams();
        params.set('bagian', bagianId);
        if (badTanggal !== null) params.set('tanggal', badTanggal);
        const search = `absensi.html?${params.toString()}`;

        expect(parseAbsensiQuery(search).valid).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});
