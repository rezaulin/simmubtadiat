// Feature: dashboard-redesign-kalender, Property 11: Pengurutan jadwal menaik dan mempertahankan entri
// Untuk setiap daftar jadwal, `sortJadwal` menghasilkan urutan tidak-menurun
// berdasarkan `jam_mulai` (HH:MM leksikografis == kronologis) dan merupakan
// permutasi (multiset yang sama) dari daftar masukan, tanpa memutasi masukan.
// Validates: Requirements 5.3

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js mengevaluasi window.matchMedia(...) di top-level (Apply Dark Mode) dan
// mengambil elemen via getElementById; jsdom tidak menyediakan matchMedia, jadi
// kita stub global sebelum mengimpor modul (dynamic import agar setup berjalan
// lebih dulu), mengikuti pola test properti lain di repo ini.
let sortJadwal;

beforeAll(async () => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  }
  // Tidak ada fetch top-level pada main.js, tetapi sediakan stub aman untuk berjaga.
  if (typeof globalThis.fetch !== 'function') {
    globalThis.fetch = () => Promise.reject(new Error('stub fetch'));
  }

  const mod = await import('../src/js/main.js');
  sortJadwal = mod.sortJadwal;
});

// Generator jam 'HH:MM' valid (00:00..23:59). Format tetap dua digit sehingga
// urutan leksikografis setara dengan urutan kronologis.
const jamArb = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

// Generator satu entri jadwal dengan field yang relevan dengan Kartu_Jadwal.
const jadwalArb = fc.record({
  jam_mulai: jamArb,
  jam_selesai: jamArb,
  nama_mapel: fc.string(),
  nama_bagian: fc.string(),
  tingkatan: fc.string(),
  kelas: fc.string(),
  bagian_id: fc.integer({ min: 1, max: 9999 }),
});

// Daftar jadwal (boleh kosong hingga cukup panjang untuk mengungkap masalah urutan).
const jadwalListArb = fc.array(jadwalArb, { maxLength: 30 });

// Kunci kanonik sebuah entri untuk perbandingan multiset (permutasi).
function entryKey(e) {
  return JSON.stringify([
    e.jam_mulai,
    e.jam_selesai,
    e.nama_mapel,
    e.nama_bagian,
    e.tingkatan,
    e.kelas,
    e.bagian_id,
  ]);
}

// Bangun multiset (Map<key, count>) dari daftar entri.
function toMultiset(list) {
  const ms = new Map();
  for (const e of list) {
    const k = entryKey(e);
    ms.set(k, (ms.get(k) || 0) + 1);
  }
  return ms;
}

function multisetsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

describe('Property 11: sortJadwal mengurutkan menaik & mempertahankan entri', () => {
  it('output tidak-menurun berdasarkan jam_mulai', () => {
    fc.assert(
      fc.property(jadwalListArb, (list) => {
        const out = sortJadwal(list);
        for (let i = 1; i < out.length; i++) {
          expect(out[i - 1].jam_mulai <= out[i].jam_mulai).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('output adalah permutasi masukan (panjang & multiset sama)', () => {
    fc.assert(
      fc.property(jadwalListArb, (list) => {
        const out = sortJadwal(list);
        expect(out.length).toBe(list.length);
        expect(multisetsEqual(toMultiset(list), toMultiset(out))).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('tidak memutasi array masukan (isi & urutan asli tetap)', () => {
    fc.assert(
      fc.property(jadwalListArb, (list) => {
        const snapshot = list.map(entryKey);
        sortJadwal(list);
        const after = list.map(entryKey);
        expect(after).toEqual(snapshot);
      }),
      { numRuns: 100 }
    );
  });
});
