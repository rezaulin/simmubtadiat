// Feature: dashboard-redesign-kalender, Property 15: Penanda dan daftar agenda
// setara dengan keberadaan agenda.
// Untuk setiap data kuartal dan Jadwal_Hari_Ini, setiap entri pada
// buildAgendaIndex bertipe 'kuartal-mulai', 'kuartal-selesai', atau 'jadwal'
// dengan tanggal yang berasal dari data sumber tersebut (tidak dari sumber lain);
// dan untuk setiap hari pada strip minggu, hari itu memiliki penanda/baris daftar
// agenda JIKA DAN HANYA JIKA agendaIndex memuat minimal satu agenda untuk tanggal
// tersebut.
// Validates: Requirements 6.1, 6.4, 6.5

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// main.js memiliki efek samping di top-level: membaca `window.matchMedia`
// (deteksi mode gelap) dan memanggil `checkAuth()` yang melakukan `fetch('/api/me')`,
// serta `startHeroClock()`. Sediakan stub global tersebut sebelum mengimpor modulnya
// (dynamic import agar setup berjalan lebih dulu). startHeroClock() berhenti awal
// karena elemen hero (#hero-date/#hero-time/#hero-hijri) sengaja tidak dibuat,
// sehingga tidak ada interval yang tertinggal.
let buildAgendaIndex, buildWeekStrip, toISODateLocal;

beforeAll(async () => {
  window.matchMedia = () => ({ matches: false });
  globalThis.matchMedia = window.matchMedia;
  // checkAuth() memanggil fetch('/api/me'); balas ok dengan objek kosong agar
  // tidak terjadi navigasi (login redirect) maupun error di jsdom.
  globalThis.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

  const mod = await import('../src/js/main.js');
  buildAgendaIndex = mod.buildAgendaIndex;
  buildWeekStrip = mod.buildWeekStrip;
  toISODateLocal = mod.toISODateLocal;
});

const VALID_TIPE = ['kuartal-mulai', 'kuartal-selesai', 'jadwal'];

// Tanggal 'today' valid pada rentang wajar; hari 1-28 menghindari tanggal
// kalender tidak valid sekaligus tetap menguji pergeseran bulan pada strip minggu.
const dateArb = fc
  .record({
    y: fc.integer({ min: 2015, max: 2035 }),
    m: fc.integer({ min: 0, max: 11 }),
    d: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ y, m, d }) => new Date(y, m, d));

// ISO 'YYYY-MM-DD' dari today + offset hari (konstruksi tanggal lokal yang setara
// dengan buildWeekStrip agar pergeseran bulan/tahun ditangani sama).
function isoFromOffset(today, offset) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return toISODateLocal(d);
}

// Generator kuartal: offset hari relatif terhadap 'today' agar sebagian tanggal
// jatuh di dalam strip minggu [0..6] (offset di luar itu menguji sisi negatif IFF).
const kuartalOffsetArb = fc.record({
  kuartal: fc.integer({ min: 1, max: 4 }),
  tahun_ajaran: fc.constantFrom('2023/2024', '2024/2025', '2025/2026'),
  mulaiOffset: fc.integer({ min: -10, max: 20 }),
  selesaiOffset: fc.integer({ min: -10, max: 20 }),
});

// Generator entri Jadwal_Hari_Ini (teks ASCII aman; hanya keberadaan entri yang
// relevan untuk properti ini karena seluruh jadwal jatuh pada tanggal hari ini).
const jadwalArb = fc.record({
  bagian_id: fc.integer({ min: 1, max: 99 }),
  nama_mapel: fc.string(),
  nama_bagian: fc.string(),
  tingkatan: fc.string(),
  kelas: fc.string(),
  jam_mulai: fc.constantFrom('07:00', '08:30', '10:15', '13:00'),
  jam_selesai: fc.constantFrom('08:00', '09:30', '11:15', '14:00'),
});

describe('Property 15: penanda & daftar agenda setara dengan keberadaan agenda', () => {
  it('setiap entri bertipe valid & bertanggal sumber; strip minggu berpenanda IFF ada agenda', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.array(kuartalOffsetArb, { maxLength: 12 }),
        fc.array(jadwalArb, { maxLength: 10 }),
        (today, kOffsets, jadwalList) => {
          const kuartalList = kOffsets.map((k) => ({
            kuartal: k.kuartal,
            tahun_ajaran: k.tahun_ajaran,
            tgl_mulai: isoFromOffset(today, k.mulaiOffset),
            tgl_selesai: isoFromOffset(today, k.selesaiOffset),
          }));

          const index = buildAgendaIndex(kuartalList, jadwalList, today);
          const todayIso = toISODateLocal(today);

          // Himpunan tanggal sumber dari data kuartal.
          const mulaiSet = new Set(kuartalList.map((k) => k.tgl_mulai));
          const selesaiSet = new Set(kuartalList.map((k) => k.tgl_selesai));

          // (1) Setiap entri bertipe valid dan bertanggal yang berasal HANYA dari
          //     data sumber terkait (kuartal-mulai/selesai dari tanggal kuartal;
          //     jadwal dari tanggal hari ini). Kunci Map juga harus konsisten.
          for (const [tanggal, agendas] of index) {
            for (const a of agendas) {
              expect(VALID_TIPE).toContain(a.tipe);
              expect(a.tanggal).toBe(tanggal);
              if (a.tipe === 'kuartal-mulai') {
                expect(mulaiSet.has(a.tanggal)).toBe(true);
              } else if (a.tipe === 'kuartal-selesai') {
                expect(selesaiSet.has(a.tanggal)).toBe(true);
              } else {
                // 'jadwal' → seluruhnya jatuh pada tanggal hari ini.
                expect(a.tanggal).toBe(todayIso);
              }
            }
          }

          // (2) Untuk setiap hari pada strip minggu: penanda/baris daftar ada
          //     JIKA DAN HANYA JIKA agendaIndex memuat ≥1 agenda untuk tanggal itu,
          //     yang setara dengan keberadaan agenda pada data sumber.
          const strip = buildWeekStrip(today);
          for (const cell of strip) {
            const iso = toISODateLocal(cell.date);
            const hasIndexAgenda = index.has(iso) && index.get(iso).length > 0;
            const expectedFromSource =
              mulaiSet.has(iso) ||
              selesaiSet.has(iso) ||
              (iso === todayIso && jadwalList.length > 0);
            expect(hasIndexAgenda).toBe(expectedFromSource);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
