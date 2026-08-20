// Feature: dashboard-redesign-kalender, Property 8: Segmen donut proporsional dan kosong saat total nol.
// Untuk setiap kumpulan kelompok status, computeDonutSegments menghasilkan segmen
// dengan fraction[i] === count[i] / total (proporsional terhadap jumlah kategori
// relatif total) dan sum(fraction) === 1 saat total > 0; saat total === 0
// mengembalikan daftar segmen kosong.
// Validates: Requirements 2.10, 2.11

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js memiliki efek samping di top-level: mengevaluasi preferensi tema
// (mengakses window.matchMedia yang tidak diimplementasikan jsdom) dan
// memasang event listener pada #theme-toggle-main. Sediakan stub DOM/matchMedia
// sebelum mengimpor modulnya (dynamic import agar setup berjalan lebih dulu).
let computeDonutSegments;

// Toleransi galat floating point untuk penjumlahan fraction.
const EPS = 1e-9;

beforeAll(async () => {
  document.body.innerHTML = '';
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    });
  }
  globalThis.fetch = globalThis.fetch || (() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));

  const mod = await import('../src/js/main.js');
  computeDonutSegments = mod.computeDonutSegments;
});

// Generator kelompok: array dari { key: string, count: nat }.
const groupArb = fc.record({
  key: fc.string(),
  count: fc.nat({ max: 100000 }),
});

const groupsArb = fc.array(groupArb, { maxLength: 200 });

describe('Property 8: computeDonutSegments — proporsional & kosong saat total nol', () => {
  it('saat total > 0: fraction[i] ≈ count[i] / total dan sum(fraction) ≈ 1', () => {
    fc.assert(
      fc.property(groupsArb, (groups) => {
        const total = groups.reduce((sum, g) => sum + g.count, 0);
        fc.pre(total > 0);

        const segments = computeDonutSegments(groups);

        // Satu segmen per kelompok masukan (entri dipertahankan).
        expect(segments.length).toBe(groups.length);

        let fractionSum = 0;
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          // Proporsional: fraction === count / total (dalam toleransi float).
          expect(seg.count).toBe(groups[i].count);
          expect(Math.abs(seg.fraction - groups[i].count / total)).toBeLessThanOrEqual(EPS);
          fractionSum += seg.fraction;
        }

        // sum(fraction) ≈ 1 saat total > 0.
        expect(Math.abs(fractionSum - 1)).toBeLessThanOrEqual(EPS);

        // Segmen terakhir dipatok berakhir tepat di 360 derajat.
        expect(segments[segments.length - 1].endAngle).toBe(360);
      }),
      { numRuns: 100 }
    );
  });

  it('saat total === 0 (semua count nol atau daftar kosong): hasil adalah []', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ key: fc.string(), count: fc.constant(0) }), { maxLength: 200 }),
        (zeroGroups) => {
          const segments = computeDonutSegments(zeroGroups);
          expect(Array.isArray(segments)).toBe(true);
          expect(segments.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('daftar kosong mengembalikan []', () => {
    expect(computeDonutSegments([])).toEqual([]);
  });

  it('sudut segmen bersambung: startAngle[0] === 0 dan endAngle[i] === startAngle[i+1]', () => {
    fc.assert(
      fc.property(groupsArb, (groups) => {
        const total = groups.reduce((sum, g) => sum + g.count, 0);
        fc.pre(total > 0);

        const segments = computeDonutSegments(groups);
        expect(segments[0].startAngle).toBe(0);
        for (let i = 0; i < segments.length - 1; i++) {
          expect(segments[i].endAngle).toBe(segments[i + 1].startAngle);
        }
      }),
      { numRuns: 100 }
    );
  });
});
