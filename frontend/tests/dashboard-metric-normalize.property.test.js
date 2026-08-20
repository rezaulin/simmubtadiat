// Feature: dashboard-redesign-kalender, Property 5: Normalisasi metrik menjadi bilangan bulat non-negatif
// Untuk setiap nilai masukan (angka, negatif, pecahan, NaN, Infinity, null,
// undefined, atau bukan-angka), toDisplayCount mengembalikan bilangan bulat
// non-negatif, dan mengembalikan 0 bila nilai tidak tersedia/tidak valid.
// Validates: Requirements 2.5, 2.6, 7.1, 7.4, 7.5

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js mengevaluasi window.matchMedia(...) di top-level (Apply dark mode)
// dan mengakses document.getElementById. jsdom menyediakan document, namun
// tidak selalu window.matchMedia — sediakan stub SEBELUM mengimpor modul
// (dynamic import agar setup berjalan lebih dulu), mengikuti pola
// pengabdian-row.property.test.js.
let toDisplayCount;

beforeAll(async () => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  }

  const mod = await import('../src/js/main.js');
  toDisplayCount = mod.toDisplayCount;
});

// Generator campuran (statsArb): bilangan bulat, negatif, pecahan, NaN,
// Infinity, null, undefined, dan nilai bukan-angka.
const statsArb = fc.oneof(
  fc.integer({ min: 0, max: 1_000_000 }),          // bilangan bulat non-negatif
  fc.integer({ min: -1_000_000, max: -1 }),        // bilangan bulat negatif
  fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true }), // pecahan non-negatif
  fc.double({ min: -1_000_000, max: -0.0001, noNaN: true, noDefaultInfinity: true }), // pecahan negatif
  fc.constantFrom(NaN, Infinity, -Infinity),       // nilai numerik non-finite
  fc.constantFrom(null, undefined),                // nilai tidak tersedia
  fc.oneof(fc.string(), fc.boolean(), fc.constant({}), fc.constant([])) // bukan-angka
);

describe('Property 5: toDisplayCount menormalkan metrik menjadi bilangan bulat non-negatif', () => {
  it('selalu mengembalikan bilangan bulat non-negatif untuk sembarang masukan', () => {
    fc.assert(
      fc.property(statsArb, (value) => {
        const result = toDisplayCount(value);
        // Selalu bilangan bulat non-negatif.
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it('mengembalikan 0 untuk nilai tidak tersedia/tidak valid (bukan-angka, negatif, NaN, Infinity, null, undefined)', () => {
    const invalidArb = fc.oneof(
      fc.integer({ min: -1_000_000, max: -1 }),
      fc.double({ min: -1_000_000, max: -0.0001, noNaN: true, noDefaultInfinity: true }),
      fc.constantFrom(NaN, Infinity, -Infinity, null, undefined),
      fc.oneof(fc.string(), fc.boolean(), fc.constant({}), fc.constant([]))
    );
    fc.assert(
      fc.property(invalidArb, (value) => {
        expect(toDisplayCount(value)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('membulatkan ke bawah nilai numerik non-negatif yang berhingga', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          // Hasil sama dengan floor(value) dan tetap bilangan bulat non-negatif.
          expect(toDisplayCount(value)).toBe(Math.floor(value));
        }
      ),
      { numRuns: 100 }
    );
  });
});
