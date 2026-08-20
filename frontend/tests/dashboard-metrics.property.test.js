// Feature: dashboard-redesign-kalender, Property 4: Widget_Statistik selalu tepat empat kartu lengkap
//
// Untuk setiap objek statistik, `renderMetrics` (main.js) menghasilkan tepat
// empat kartu ([data-metric-card]); setiap kartu memuat sebuah garis aksen
// ([data-accent]), sebuah badge ([data-badge]), dan sebuah nilai metrik numerik
// ([data-metric-value] yang bernilai bilangan bulat non-negatif). Salah satu
// kartu adalah kartu "Santri Pengabdian".
//
// Validates: Requirements 2.4

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js has top-level side effects (dark-mode check via matchMedia, an auth
// fetch via checkAuth(), and a hero clock). Stub the browser globals it touches
// BEFORE importing the module so the pure/render exports load without throwing.
let renderMetrics;

beforeAll(async () => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() { return false; },
    });
  }
  // checkAuth() runs on import and awaits fetch('/api/me'); give it a benign
  // response so no navigation/redirect side effect is triggered in jsdom.
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ nama: '', role: '' }) });

  const mod = await import('../src/js/main.js');
  renderMetrics = mod.renderMetrics;
});

// Generator for a single metric value: a mix of valid numbers, negatives,
// fractions, NaN, and nullish values to exercise normalization.
const metricValueArb = fc.oneof(
  fc.integer({ min: -1000, max: 100000 }),
  fc.double({ min: -1000, max: 100000, noDefaultInfinity: true }),
  fc.constant(NaN),
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),
);

// A stats object with an arbitrary subset of known/unknown metric keys, each
// carrying a possibly-invalid value. Missing keys are exercised by the subset.
const knownKeys = [
  'total_santri', 'santri',
  'pengabdian', 'santri_pengabdian', 'total_pengabdian',
  'total_bagian', 'bagian',
  'total_alumni', 'alumni',
];

const statsArb = fc.oneof(
  // Object built from a subset of known keys with mixed values.
  fc.dictionary(fc.constantFrom(...knownKeys), metricValueArb),
  // Object with arbitrary keys (may miss all known metric keys).
  fc.dictionary(fc.string(), metricValueArb),
  // Degenerate inputs: renderMetrics must tolerate non-objects too.
  fc.constant(null),
  fc.constant(undefined),
  fc.constant({}),
);

function parseCards(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return Array.from(container.querySelectorAll('[data-metric-card]'));
}

describe('Property 4: renderMetrics — selalu tepat empat kartu lengkap', () => {
  it('menghasilkan tepat empat kartu, masing-masing dengan aksen, badge, dan nilai numerik non-negatif', () => {
    fc.assert(
      fc.property(statsArb, (stats) => {
        const html = renderMetrics(stats);
        const cards = parseCards(html);

        // Tepat empat kartu.
        expect(cards.length).toBe(4);

        for (const card of cards) {
          // Garis aksen.
          expect(card.querySelector('[data-accent]')).not.toBeNull();
          // Badge.
          expect(card.querySelector('[data-badge]')).not.toBeNull();
          // Nilai metrik: bilangan bulat non-negatif.
          const valueEl = card.querySelector('[data-metric-value]');
          expect(valueEl).not.toBeNull();
          const text = valueEl.textContent.trim();
          expect(text).toMatch(/^\d+$/);
          const n = Number(text);
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
        }

        // Salah satu kartu adalah "Santri Pengabdian".
        const hasPengabdian = cards.some((card) =>
          card.textContent.includes('Santri Pengabdian')
        );
        expect(hasPengabdian).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
