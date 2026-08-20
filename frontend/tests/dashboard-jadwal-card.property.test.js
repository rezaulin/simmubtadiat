// Feature: dashboard-redesign-kalender, Property 12: Kartu_Jadwal memuat seluruh field wajib
//
// Untuk setiap entri jadwal, `renderJadwalCard` menghasilkan markup yang memuat
// `jam_mulai`, `jam_selesai`, `nama_mapel`, `nama_bagian`, `tingkatan`, dan
// `kelas` (dalam bentuk ter-escape).
//
// Validates: Requirements 5.4

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js has top-level side effects (dark-mode check via matchMedia, an auth
// fetch via checkAuth(), and a hero clock). Stub the browser globals it touches
// BEFORE importing the module so the pure/render exports load without throwing.
// This mirrors the setup used by the other dashboard property tests.
let renderJadwalCard;

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
  renderJadwalCard = mod.renderJadwalCard;
});

// Canonical HTML escaper matching xss.js escapeHTML (escapes & < > ' ").
// Because the generators below only produce "safe" ASCII (no special chars),
// escaping is the identity here, which keeps containment assertions meaningful:
// the field value appears verbatim in the rendered markup.
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[c]);
}

// Safe ASCII text: letters, digits and spaces only. Non-empty (fallback 'X'
// when the draw is all-spaces after trim) so containment is a real check.
const SAFE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('');
const safeText = fc
  .array(fc.constantFrom(...SAFE_CHARS), { minLength: 1, maxLength: 24 })
  .map((chars) => chars.join('').trim())
  .map((s) => (s === '' ? 'X' : s));

// 'HH:MM' time strings (valid clock values).
const two = (n) => String(n).padStart(2, '0');
const timeArb = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${two(h)}:${two(m)}`);

// A jadwal entry with all six required fields plus a numeric bagian_id.
const jadwalArb = fc.record({
  jam_mulai: timeArb,
  jam_selesai: timeArb,
  nama_mapel: safeText,
  nama_bagian: safeText,
  tingkatan: safeText,
  kelas: safeText,
  bagian_id: fc.integer({ min: 1, max: 99999 }),
});

describe('Property 12: Kartu_Jadwal memuat seluruh field wajib', () => {
  it('renderJadwalCard memuat jam_mulai, jam_selesai, nama_mapel, nama_bagian, tingkatan, kelas (ter-escape)', () => {
    fc.assert(
      fc.property(jadwalArb, (entry) => {
        const today = new Date(2024, 0, 15); // fixed local date; irrelevant to fields
        const markup = renderJadwalCard(entry, today);

        expect(typeof markup).toBe('string');

        // Containment: every required field's escaped value must appear in markup.
        for (const field of ['jam_mulai', 'jam_selesai', 'nama_mapel', 'nama_bagian', 'tingkatan', 'kelas']) {
          expect(markup).toContain(escapeHTML(entry[field]));
        }

        // Stronger, precise check: each field lands in its dedicated data-slot,
        // so a value can't be satisfied by coincidentally matching another field.
        const host = document.createElement('div');
        host.innerHTML = markup;
        const slot = (attr) => host.querySelector(`[${attr}]`);

        expect(slot('data-jam-mulai')?.textContent).toContain(entry.jam_mulai);
        expect(slot('data-jam-selesai')?.textContent).toContain(entry.jam_selesai);
        expect(slot('data-nama-mapel')?.textContent).toContain(entry.nama_mapel);
        expect(slot('data-nama-bagian')?.textContent).toContain(entry.nama_bagian);
        expect(slot('data-tingkatan')?.textContent).toContain(entry.tingkatan);
        expect(slot('data-kelas')?.textContent).toContain(entry.kelas);
      }),
      { numRuns: 200 }
    );
  });
});
