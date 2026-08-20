// Feature: dashboard-redesign-kalender, Property 3: Hero selalu memuat elemen wajib dengan placeholder aman
//
// Untuk setiap nama dan peran (termasuk kosong/null), hasil `renderHero` memuat
// teks salam, nama pengguna (ter-escape) atau placeholder saat kosong, badge
// peran atau placeholder saat kosong, serta elemen tanggal, waktu, dan hijriah,
// tanpa melempar error.
//
// Validates: Requirements 2.1, 2.3

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js has top-level side effects (dark-mode check via matchMedia, an
// auth fetch, and a hero clock). Stub the browser globals it touches BEFORE
// importing the module so the pure export can be loaded without throwing.
let renderHero;

// Placeholder yang dipakai renderHero saat nama/peran tidak tersedia (Req 2.3).
const NAME_PLACEHOLDER = 'Pengguna';
const ROLE_PLACEHOLDER = '—';
const GREETING = "Assalamu'alaikum";

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
  renderHero = mod.renderHero;
});

// Replika logika label peran dari main.js (formatRoleLabel) untuk menghitung
// nilai yang diharapkan tampil pada badge peran.
function expectedRoleLabel(role) {
  if (role == null) return '';
  const str = String(role).trim();
  if (str === '') return '';
  return str.toUpperCase().replace(/_/g, ' ');
}

// String yang dijamin memuat karakter khusus HTML, dicampur teks biasa, untuk
// memverifikasi escaping (karakter mentah tidak boleh muncul sebagai markup).
const htmlSpecialArb = fc
  .array(
    fc.oneof(
      fc.constantFrom('<', '>', '&', '"', "'", '<script>', '<img src=x onerror=alert(1)>', '</h2>', '&amp;'),
      fc.string({ minLength: 1, maxLength: 4 })
    ),
    { minLength: 1, maxLength: 6 }
  )
  .map((parts) => parts.join(''));

// Ruang masukan nama/peran: string bebas, string dengan karakter khusus HTML,
// dan nilai tidak tersedia (kosong/null/undefined/whitespace).
const nameArb = fc.oneof(
  fc.string(),
  htmlSpecialArb,
  fc.constantFrom('', '   ', null, undefined)
);

const roleArb = fc.oneof(
  fc.string(),
  htmlSpecialArb,
  fc.constantFrom('', '   ', null, undefined, 'wali_santri', 'mustahiq')
);

// Parse markup hero menjadi dokumen agar bisa memeriksa keberadaan elemen dan
// textContent (yang otomatis men-decode entitas HTML — verifikasi escaping).
function parseHero(html) {
  const parser = new DOMParser();
  // Bungkus dalam kontainer agar fragmen inner content ter-parse sebagai anak.
  return parser.parseFromString(`<!DOCTYPE html><body>${html}</body>`, 'text/html');
}

describe('Property 3: hero selalu memuat elemen wajib dengan placeholder aman', () => {
  it('renderHero tidak melempar, memuat elemen wajib, dan meng-escape nama/peran', () => {
    fc.assert(
      fc.property(nameArb, roleArb, (nama, role) => {
        // (1) Tidak pernah melempar error untuk masukan apa pun.
        let html;
        expect(() => {
          html = renderHero(nama, role);
        }).not.toThrow();
        expect(typeof html).toBe('string');

        const doc = parseHero(html);

        // (2) Teks salam hadir.
        const greetingEl = doc.getElementById('greeting-text');
        expect(greetingEl).not.toBeNull();
        expect(greetingEl.textContent).toContain(GREETING);

        // (3) Nama pengguna: elemen wajib ada; nilai ter-escape atau placeholder.
        const greetingNameEl = doc.getElementById('user-greeting');
        expect(greetingNameEl).not.toBeNull();
        // Escaping berhasil ⇒ tidak ada elemen anak yang ter-inject dari input.
        expect(greetingNameEl.children.length).toBe(0);
        const trimmedName = nama == null ? '' : String(nama).trim();
        const expectedName = trimmedName === '' ? NAME_PLACEHOLDER : trimmedName;
        // textContent men-decode entitas kembali ke karakter mentah ⇒ round-trip.
        expect(greetingNameEl.textContent).toBe(expectedName);

        // (4) Badge peran: elemen wajib ada; nilai ter-escape atau placeholder.
        const roleEl = doc.getElementById('user-role-badge');
        expect(roleEl).not.toBeNull();
        expect(roleEl.children.length).toBe(0);
        const roleLabel = expectedRoleLabel(role);
        const expectedRole = roleLabel === '' ? ROLE_PLACEHOLDER : roleLabel;
        expect(roleEl.textContent).toBe(expectedRole);

        // (5) Elemen tanggal, waktu, dan hijriah selalu hadir.
        expect(doc.getElementById('hero-date')).not.toBeNull();
        expect(doc.getElementById('hero-time')).not.toBeNull();
        expect(doc.getElementById('hero-hijri')).not.toBeNull();

        // (6) Escaping: karakter khusus dari input tidak muncul sebagai markup.
        // Bila input mengandung tag, tidak boleh membuat elemen <script>/<img>
        // di dalam badan dokumen selain elemen hero yang dikenal.
        expect(doc.querySelector('#user-greeting script')).toBeNull();
        expect(doc.querySelector('#user-greeting img')).toBeNull();
        expect(doc.querySelector('#user-role-badge script')).toBeNull();
        expect(doc.querySelector('#user-role-badge img')).toBeNull();
      }),
      { numRuns: 200 }
    );
  });
});
