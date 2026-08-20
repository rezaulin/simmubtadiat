// Feature: dashboard-redesign-kalender, Property 9: Kartu ringkasan ponsel berurutan dan lengkap
// Untuk setiap nilai ringkasan (santri, khidmah, alumni), renderMobileSummary
// menghasilkan tepat tiga blok dengan urutan Santri -> Khidmah -> Alumni, dan
// setiap blok memuat labelnya serta nilai ringkasan numeriknya.
// Validates: Requirements 3.2

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js memiliki efek samping di top-level: mengevaluasi window.matchMedia
// (Apply Theme), memanggil checkAuth() (fetch('/api/me')) dan startHeroClock().
// Kita stub matchMedia & fetch sebelum mengimpor modul (dynamic import agar
// setup berjalan lebih dulu), mengikuti pola selesai-khidmah-gating.property.test.js.
let renderMobileSummary;
let toDisplayCount;

beforeAll(async () => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  }

  // checkAuth() memanggil fetch('/api/me'); buat gagal agar masuk blok catch
  // tanpa navigasi jsdom. Rejection ditangani di dalam try/catch modul.
  globalThis.fetch = () => Promise.reject(new Error('stub fetch'));

  const mod = await import('../src/js/main.js');
  renderMobileSummary = mod.renderMobileSummary;
  toDisplayCount = mod.toDisplayCount;
});

// Urutan blok kanonik sesuai Req 3.2.
const EXPECTED_BLOCKS = [
  { key: 'santri', label: 'Santri', fields: ['santri', 'total_santri'] },
  { key: 'khidmah', label: 'Khidmah', fields: ['khidmah', 'pengabdian', 'santri_pengabdian'] },
  { key: 'alumni', label: 'Alumni', fields: ['alumni', 'total_alumni'] },
];

// Generator nilai metrik: campuran valid, hilang, dan tidak valid.
const metricValueArb = fc.oneof(
  fc.nat(),                                  // bilangan bulat non-negatif
  fc.integer({ min: -1000, max: 1000 }),     // termasuk negatif
  fc.double(),                               // pecahan / NaN / Infinity
  fc.constant(NaN),
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),                               // non-number
  fc.boolean()
);

// Semua nama field yang mungkin dibaca renderMobileSummary lintas ketiga blok.
const ALL_FIELDS = [
  'santri', 'total_santri',
  'khidmah', 'pengabdian', 'santri_pengabdian',
  'alumni', 'total_alumni',
];

// Generator objek ringkasan: setiap field opsional (mungkin hilang), dengan
// nilai campuran valid/tidak valid. Juga menyertakan field asing yang diabaikan.
const summaryArb = fc.record(
  Object.fromEntries(ALL_FIELDS.map((f) => [f, metricValueArb])),
  { requiredKeys: [] }
).chain((base) =>
  fc.record({ noise: fc.string() }).map((extra) => ({ ...base, extra_field: extra.noise }))
);

// Parse HTML string -> Document via jsdom (DOMParser tersedia di lingkungan jsdom).
function parse(html) {
  return new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
}

describe('Property 9: kartu ringkasan ponsel berurutan dan lengkap', () => {
  it('renderMobileSummary selalu menghasilkan tepat tiga blok Santri -> Khidmah -> Alumni dengan label & nilai numerik', () => {
    fc.assert(
      fc.property(summaryArb, (summary) => {
        const doc = parse(renderMobileSummary(summary));
        const blocks = doc.querySelectorAll('[data-summary-block]');

        // Tepat tiga blok.
        expect(blocks.length).toBe(3);

        blocks.forEach((block, i) => {
          const expected = EXPECTED_BLOCKS[i];

          // Urutan sesuai key kanonik: santri -> khidmah -> alumni.
          expect(block.getAttribute('data-summary-block')).toBe(expected.key);

          // Blok memuat label dengan teks yang benar.
          const label = block.querySelector('[data-summary-label]');
          expect(label).not.toBeNull();
          expect(label.textContent.trim()).toBe(expected.label);

          // Blok memuat nilai ringkasan numerik non-negatif integer.
          // (Format string boleh eksponensial untuk angka sangat besar; yang
          // diverifikasi adalah nilai numeriknya, bukan representasi teksnya.)
          const valueEl = block.querySelector('[data-summary-value]');
          expect(valueEl).not.toBeNull();
          const text = valueEl.textContent.trim();
          expect(text.length).toBeGreaterThan(0);
          const num = Number(text);
          expect(Number.isFinite(num)).toBe(true);
          expect(Number.isInteger(num)).toBe(true);
          expect(num).toBeGreaterThanOrEqual(0);

          // Nilai konsisten dengan toDisplayCount atas field pertama yang tersedia.
          let raw;
          for (const f of expected.fields) {
            if (Object.prototype.hasOwnProperty.call(summary, f)) { raw = summary[f]; break; }
          }
          expect(num).toBe(toDisplayCount(raw));
        });
      }),
      { numRuns: 200 }
    );
  });

  it('menangani ringkasan kosong / non-objek dengan tiga blok bernilai 0', () => {
    for (const input of [undefined, null, {}, 'x', 42, []]) {
      const doc = parse(renderMobileSummary(input));
      const blocks = doc.querySelectorAll('[data-summary-block]');
      expect(blocks.length).toBe(3);
      blocks.forEach((block, i) => {
        expect(block.getAttribute('data-summary-block')).toBe(EXPECTED_BLOCKS[i].key);
        expect(block.querySelector('[data-summary-label]').textContent.trim()).toBe(EXPECTED_BLOCKS[i].label);
        expect(block.querySelector('[data-summary-value]').textContent.trim()).toBe('0');
      });
    }
  });
});
