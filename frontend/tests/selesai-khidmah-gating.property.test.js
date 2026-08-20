// Feature: santri-pengabdian-khidmah, Property 11: Gating tombol "Selesai Khidmah → Alumni" per peran.
// Untuk setiap peran pengguna, tombol "Selesai Khidmah → Alumni" ditampilkan
// pada tab Pengabdian JIKA DAN HANYA JIKA peran tersebut adalah penulis
// (`pimpinan`). Admin bersifat read-only untuk fitur Alumni/Pengabdian sehingga
// TIDAK melihat tombol tulis. Fungsi murni canShowSelesaiKhidmah(role)
// mendelegasikan ke window.isPimpinanRole(role).
// Validates: Requirements 8.3

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// alumni.js memiliki banyak efek samping di top-level: ia mengambil sejumlah
// elemen via getElementById dan LANGSUNG memanggil `.addEventListener` pada
// beberapa di antaranya, lalu memanggil checkAuth() (fetch('/api/me')).
// Kita siapkan elemen-elemen tersebut dan stub global (matchMedia, fetch,
// isPimpinanRole) sebelum mengimpor modul (dynamic import agar setup DOM berjalan
// lebih dulu), mengikuti pola pengabdian-row.property.test.js (task 10.4).
let canShowSelesaiKhidmah;

// Aturan kanonik penulis Alumni/Pengabdian: hanya pimpinan (admin read-only).
function isPimpinanRoleCanonical(role) {
  return role === 'pimpinan';
}

beforeAll(async () => {
  document.body.innerHTML = `
    <input id="search-input" />
    <button id="btn-tambah"></button>
    <button id="modal-close"></button>
    <button id="btn-cancel"></button>
    <div id="modal-overlay"></div>
    <form id="form-alumni"></form>
    <button id="modal-detail-close"></button>
    <div id="modal-detail-overlay"></div>
    <form id="form-update-alumni"></form>
    <div id="pengabdian-list"></div>
  `;

  // alumni.js mengevaluasi window.matchMedia(...) di top-level (Apply Theme);
  // jsdom tidak menyediakannya, jadi sediakan stub.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  }

  // canShowSelesaiKhidmah mendelegasikan ke window.isPimpinanRole; sediakan
  // implementasi kanonik penulis agar properti iff dapat diuji langsung.
  globalThis.isPimpinanRole = isPimpinanRoleCanonical;
  window.isPimpinanRole = globalThis.isPimpinanRole;

  // checkAuth() memanggil fetch('/api/me'); buat gagal agar masuk ke blok catch
  // tanpa navigasi jsdom. Rejection ditangani di dalam try/catch modul.
  globalThis.fetch = () => Promise.reject(new Error('stub fetch'));

  const mod = await import('../src/js/alumni.js');
  canShowSelesaiKhidmah = mod.canShowSelesaiKhidmah;
});

// Peran yang dikenal dalam sistem (penulis dan pembaca) + string kosong.
const knownRoles = ['pimpinan', 'admin', 'mufatish', 'mustahiq', 'muroqib', 'tim_rapot', 'keamanan', 'wali_santri', ''];

// Generator peran: campuran peran dikenal dan string acak sembarang, sehingga
// menguji baik ruang input valid maupun nilai tak terduga.
const roleArb = fc.oneof(
  fc.constantFrom(...knownRoles),
  fc.string()
);

describe('Property 11: gating tombol "Selesai Khidmah → Alumni" per peran (iff pimpinan)', () => {
  it('canShowSelesaiKhidmah(role) === true iff role adalah "pimpinan"', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        const expected = role === 'pimpinan';
        expect(canShowSelesaiKhidmah(role)).toBe(expected);
      }),
      { numRuns: 500 }
    );
  });

  it('tepat untuk setiap peran yang dikenal', () => {
    for (const role of knownRoles) {
      const expected = role === 'pimpinan';
      expect(canShowSelesaiKhidmah(role)).toBe(expected);
    }
  });
});
