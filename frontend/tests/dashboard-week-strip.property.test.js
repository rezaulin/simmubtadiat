// Feature: dashboard-redesign-kalender, Property 14: Strip minggu tujuh hari berurutan memuat hari ini
//
// Untuk setiap tanggal hari ini, `buildWeekStrip` menghasilkan tepat tujuh
// tanggal berurutan menaik berselisih satu hari, mengandung tanggal hari ini,
// dengan tepat satu sel bertanda `isToday`.
//
// Validates: Requirements 6.3

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js has top-level side effects (dark-mode check via matchMedia, an
// auth fetch, and a hero clock). Stub the browser globals it touches BEFORE
// importing the module so the pure exports can be loaded without throwing.
let buildWeekStrip;
let toISODateLocal;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  buildWeekStrip = mod.buildWeekStrip;
  toISODateLocal = mod.toISODateLocal;
});

// A valid "today" Date within a reasonable range (2000-01-01 .. 2049-12-31),
// constructed from year/month/day so we always get a valid local calendar date
// (no NaN/invalid dates leaking into the generator).
const dateArb = fc
  .record({
    year: fc.integer({ min: 2000, max: 2049 }),
    month: fc.integer({ min: 0, max: 11 }),
    day: fc.integer({ min: 1, max: 28 }), // <=28 keeps every day valid in every month
  })
  .map(({ year, month, day }) => new Date(year, month, day));

// Number of whole calendar days between two local dates (b - a), robust to DST
// by normalizing both to local midnight before differencing.
function calendarDayDelta(a, b) {
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid.getTime() - aMid.getTime()) / MS_PER_DAY);
}

describe('Property 14: strip minggu tujuh hari berurutan memuat hari ini', () => {
  it('menghasilkan 7 tanggal berurutan menaik, memuat hari ini, tepat satu isToday', () => {
    fc.assert(
      fc.property(dateArb, (today) => {
        const strip = buildWeekStrip(today);
        const todayIso = toISODateLocal(today);

        // Tepat tujuh entri.
        expect(Array.isArray(strip)).toBe(true);
        expect(strip).toHaveLength(7);

        // Setiap entri berbentuk { date: Date, isToday: boolean }.
        for (const entry of strip) {
          expect(entry.date instanceof Date).toBe(true);
          expect(Number.isNaN(entry.date.getTime())).toBe(false);
          expect(typeof entry.isToday).toBe('boolean');
        }

        // Berurutan menaik berselisih tepat satu hari kalender.
        for (let i = 1; i < strip.length; i++) {
          expect(calendarDayDelta(strip[i - 1].date, strip[i].date)).toBe(1);
        }

        // Strip mengandung tanggal hari ini.
        const isoDates = strip.map((e) => toISODateLocal(e.date));
        expect(isoDates).toContain(todayIso);

        // Tepat satu sel bertanda isToday, dan sel itu adalah tanggal hari ini.
        const todayEntries = strip.filter((e) => e.isToday);
        expect(todayEntries).toHaveLength(1);
        expect(toISODateLocal(todayEntries[0].date)).toBe(todayIso);
      }),
      { numRuns: 200 }
    );
  });
});
