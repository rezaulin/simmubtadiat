// Feature: santri-pengabdian-khidmah, Property 10: Baris daftar pengabdian memuat field wajib.
// Untuk setiap item pengabdian, hasil render barisnya (renderPengabdianRow)
// memuat nama santri, tempat khidmah (khidmah_tempat), dan tanggal mulai
// khidmah (khidmah_mulai) — dengan memperhitungkan transformasi formatTanggal
// dan escaping HTML yang diterapkan fungsi render.
// Validates: Requirements 8.2

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// alumni.js memiliki banyak efek samping di top-level: ia mengambil sejumlah
// elemen via getElementById dan LANGSUNG memanggil `.addEventListener` pada
// beberapa di antaranya (search-input, btn-tambah, modal-close, btn-cancel,
// modal-overlay, form-alumni, modal-detail-close, modal-detail-overlay,
// form-update-alumni), lalu memanggil checkAuth() (fetch('/api/me')).
// Kita siapkan elemen-elemen tersebut dan stub global (fetch, isPimpinanRole)
// sebelum mengimpor modul (dynamic import agar setup DOM berjalan lebih dulu),
// mengikuti pola profil-status-label.property.test.js.
let renderPengabdianRow;

// Escaping identik dengan escapeHtml pada alumni.js — dipakai untuk menghitung
// bentuk terharap dari nilai setelah dirender.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Transformasi identik dengan formatTanggal pada alumni.js — dipakai untuk
// menghitung tampilan terharap dari khidmah_mulai.
function formatTanggal(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
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

  // checkAuth() memanggil window.isPimpinanRole(role); sediakan stub agar aman.
  // (isAdminRole tetap disediakan untuk kompatibilitas helper lain.)
  globalThis.isPimpinanRole = () => false;
  window.isPimpinanRole = globalThis.isPimpinanRole;
  globalThis.isAdminRole = () => false;
  window.isAdminRole = globalThis.isAdminRole;

  // checkAuth() memanggil fetch('/api/me'); buat gagal agar masuk ke blok catch
  // tanpa navigasi jsdom. Rejection ditangani di dalam try/catch modul.
  globalThis.fetch = () => Promise.reject(new Error('stub fetch'));

  const mod = await import('../src/js/alumni.js');
  renderPengabdianRow = mod.renderPengabdianRow;
});

// Teks ASCII sederhana (huruf, angka, spasi) yang lolos escaping tanpa berubah,
// sehingga containment bermakna dan tidak rapuh terhadap transformasi escaping.
const safeChar = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')
);
const safeText = fc.stringOf(safeChar, { minLength: 1, maxLength: 40 });

// Tanggal ISO valid (YYYY-MM-DD). Hari dibatasi 1..28 agar valid untuk semua bulan.
const isoDateArb = fc
  .record({
    year: fc.integer({ min: 1990, max: 2035 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ year, month, day }) => {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  });

describe('Property 10: renderPengabdianRow memuat field wajib (nama, tempat, mulai)', () => {
  it('setiap baris memuat nama, khidmah_tempat, dan khidmah_mulai (terformat)', () => {
    fc.assert(
      fc.property(
        safeText,
        safeText,
        isoDateArb,
        fc.integer({ min: 1, max: 100000 }),
        fc.boolean(),
        (nama, khidmahTempat, khidmahMulai, id, canWrite) => {
          const item = {
            id,
            nama,
            stambuk: `STB-${id}`,
            khidmah_tempat: khidmahTempat,
            khidmah_mulai: khidmahMulai,
          };

          const row = renderPengabdianRow(item, canWrite);

          // Nama santri muncul (bentuk ter-escape; untuk teks aman = apa adanya).
          expect(row).toContain(escapeHtml(nama));
          // Tempat khidmah muncul.
          expect(row).toContain(escapeHtml(khidmahTempat));
          // Tanggal mulai khidmah muncul dalam bentuk terformat oleh formatTanggal.
          const mulaiTampil = escapeHtml(formatTanggal(khidmahMulai));
          expect(row).toContain(mulaiTampil);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('tetap memuat field wajib meski khidmah_tempat/khidmah_mulai kosong (fallback)', () => {
    fc.assert(
      fc.property(safeText, (nama) => {
        const item = { id: 1, nama, stambuk: 'STB-1' };
        const row = renderPengabdianRow(item, false);
        expect(row).toContain(escapeHtml(nama));
        // Tempat & tanggal kosong → fallback '-' (formatTanggal('') === '-').
        expect(row).toContain('-');
      }),
      { numRuns: 100 }
    );
  });
});
