// Feature: dashboard-redesign-kalender, Property 7: Komposisi status adalah partisi santri.
// Untuk setiap daftar santri, groupByStatus menempatkan setiap santri tepat pada
// satu kelompok (kelompok saling lepas / disjoint) sehingga jumlah seluruh count
// sama dengan jumlah santri, dan santri dengan status kosong/null/undefined masuk
// kelompok "Tidak Diketahui" namun tetap dihitung.
// Validates: Requirements 7.3, 7.8

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js memiliki efek samping di top-level: mengevaluasi preferensi tema
// (mengakses window.matchMedia yang tidak diimplementasikan jsdom) dan
// memasang event listener pada #theme-toggle-main. Sediakan stub DOM/matchMedia
// sebelum mengimpor modulnya (dynamic import agar setup berjalan lebih dulu).
let groupByStatus;

const UNKNOWN = 'Tidak Diketahui';

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
  groupByStatus = mod.groupByStatus;
});

// Generator status: gabungan status DB valid dan varian "kosong" (string kosong,
// whitespace, null, undefined) untuk menguji pengelompokan "Tidak Diketahui".
const statusArb = fc.oneof(
  fc.constantFrom('aktif', 'pengabdian', 'boyong', 'keluar', 'alumni', 'lulus', 'cuti'),
  fc.constantFrom('', '   ', null, undefined)
);

// santriArb: record { tingkatan_nama, status } dengan varian status kosong/null/undefined.
const santriArb = fc.record({
  tingkatan_nama: fc.oneof(fc.string(), fc.constantFrom(null, undefined)),
  status: statusArb,
});

// Menentukan apakah sebuah nilai status dianggap "kosong" (→ Tidak Diketahui).
function isEmptyStatus(status) {
  return status == null || (typeof status === 'string' && status.trim() === '');
}

describe('Property 7: groupByStatus — komposisi status adalah partisi santri', () => {
  it('jumlah seluruh count sama dengan jumlah santri (konservasi total)', () => {
    fc.assert(
      fc.property(fc.array(santriArb, { maxLength: 200 }), (santriList) => {
        const groups = groupByStatus(santriList);
        const totalCount = groups.reduce((sum, g) => sum + g.count, 0);
        // Setiap santri terhitung tepat satu kali → total count === jumlah santri.
        expect(totalCount).toBe(santriList.length);
      }),
      { numRuns: 100 }
    );
  });

  it('kelompok saling lepas: setiap key unik (tidak ada key ganda)', () => {
    fc.assert(
      fc.property(fc.array(santriArb, { maxLength: 200 }), (santriList) => {
        const groups = groupByStatus(santriList);
        const keys = groups.map((g) => g.key);
        // Groups disjoint ⇒ keys unik ⇒ tidak ada santri dihitung di dua kelompok.
        expect(new Set(keys).size).toBe(keys.length);
        // Setiap count adalah bilangan bulat positif (kelompok tak pernah kosong).
        for (const g of groups) {
          expect(Number.isInteger(g.count)).toBe(true);
          expect(g.count).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('setiap santri dipetakan ke tepat satu kelompok sesuai statusnya (empty/null → "Tidak Diketahui")', () => {
    fc.assert(
      fc.property(fc.array(santriArb, { maxLength: 200 }), (santriList) => {
        const groups = groupByStatus(santriList);
        const groupMap = new Map(groups.map((g) => [g.key, g.count]));

        // Hitung ekspektasi secara independen dari implementasi.
        const expected = new Map();
        for (const santri of santriList) {
          const key = isEmptyStatus(santri.status) ? UNKNOWN : santri.status.trim();
          expected.set(key, (expected.get(key) || 0) + 1);
        }

        // Kesamaan dua peta hitung: partisi identik.
        expect(groupMap.size).toBe(expected.size);
        for (const [key, count] of expected) {
          expect(groupMap.get(key)).toBe(count);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('santri dengan status kosong/null/undefined tetap dihitung pada "Tidak Diketahui"', () => {
    fc.assert(
      fc.property(
        fc.array(santriArb, { maxLength: 100 }),
        fc.nat({ max: 50 }),
        (santriList, extraEmpty) => {
          // Sisipkan sejumlah santri dengan status kosong yang bervariasi.
          const emptyVariants = ['', '   ', null, undefined];
          const withEmpty = santriList.concat(
            Array.from({ length: extraEmpty }, (_, i) => ({
              tingkatan_nama: 'X',
              status: emptyVariants[i % emptyVariants.length],
            }))
          );
          const groups = groupByStatus(withEmpty);
          const expectedUnknown = withEmpty.filter((s) => isEmptyStatus(s.status)).length;
          const unknownGroup = groups.find((g) => g.key === UNKNOWN);

          if (expectedUnknown === 0) {
            expect(unknownGroup).toBeUndefined();
          } else {
            expect(unknownGroup).toBeDefined();
            expect(unknownGroup.count).toBe(expectedUnknown);
          }
          // Konservasi total tetap berlaku.
          const totalCount = groups.reduce((sum, g) => sum + g.count, 0);
          expect(totalCount).toBe(withEmpty.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
