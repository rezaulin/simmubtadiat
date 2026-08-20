// Feature: dashboard-redesign-kalender, Property 6: Distribusi tingkatan mengonservasi total santri
//
// Untuk setiap daftar santri, jumlah `count` seluruh kelompok hasil
// `groupByTingkatan` sama dengan jumlah santri pada daftar, dan santri dengan
// `tingkatan_nama` kosong/null/undefined dikelompokkan ke "Tidak Diketahui"
// namun tetap ikut dihitung.
//
// Validates: Requirements 7.2, 7.8

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js has top-level side effects (dark-mode check via matchMedia, an
// auth fetch, and a hero clock). Stub the browser globals it touches BEFORE
// importing the module so the pure export can be loaded without throwing.
let groupByTingkatan;

const UNKNOWN_LABEL = 'Tidak Diketahui';

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

  ({ groupByTingkatan } = await import('../src/js/main.js'));
});

// A tingkatan_nama value: real-looking names, plus the "unknown" variants
// (empty string, whitespace-only, null, undefined) and arbitrary strings.
const tingkatanNamaArb = fc.oneof(
  fc.constantFrom('Ula', 'Wustha', 'Ulya', 'I', 'II', 'III'),
  fc.constant(''),
  fc.constantFrom(' ', '   ', '\t', '\n'),
  fc.constant(null),
  fc.constant(undefined),
  fc.string()
);

// A santri record with a tingkatan_nama and an (irrelevant-to-this-property)
// status field to mirror the real /api/santri shape.
const santriArb = fc.record({
  tingkatan_nama: tingkatanNamaArb,
  status: fc.oneof(fc.constantFrom('aktif', 'pengabdian', 'alumni'), fc.constant(null), fc.constant(undefined)),
});

// Oracle: a santri counts as "unknown tingkatan" when tingkatan_nama is
// null/undefined or a string that trims to empty.
function isUnknownTingkatan(santri) {
  const raw = santri.tingkatan_nama;
  if (raw == null) return true;
  if (typeof raw === 'string') return raw.trim() === '';
  return false;
}

describe('Property 6: distribusi tingkatan mengonservasi total santri', () => {
  it('sum of group counts equals number of santri, and empty/null tingkatan → "Tidak Diketahui"', () => {
    fc.assert(
      fc.property(fc.array(santriArb, { maxLength: 200 }), (santriList) => {
        const groups = groupByTingkatan(santriList);

        // Conservation of total: every santri is counted exactly once.
        const totalCount = groups.reduce((sum, g) => sum + g.count, 0);
        expect(totalCount).toBe(santriList.length);

        // Empty/null/undefined tingkatan_nama are grouped under "Tidak Diketahui"
        // but remain counted.
        const expectedUnknown = santriList.filter(isUnknownTingkatan).length;
        const unknownGroup = groups.find((g) => g.key === UNKNOWN_LABEL);
        const actualUnknown = unknownGroup ? unknownGroup.count : 0;
        expect(actualUnknown).toBe(expectedUnknown);

        // Group keys are unique (each santri lands in exactly one group).
        const keys = groups.map((g) => g.key);
        expect(new Set(keys).size).toBe(keys.length);
      }),
      { numRuns: 100 }
    );
  });
});
