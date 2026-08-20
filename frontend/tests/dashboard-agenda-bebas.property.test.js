// Fitur: agenda-bebas (kalender agenda manual).
// Property test untuk dua fungsi murni baru di main.js:
//   - buildAgendaIndex(..., agendaList): agenda bebas ditambahkan sebagai entri
//     bertipe 'acara' pada setiap tanggal yang dicakup ([tgl_mulai..tgl_selesai]),
//     tanggal berasal HANYA dari data agenda; backward-compatible saat argumen
//     agenda tidak diberikan (tidak ada entri 'acara').
//   - filterUpcomingAgenda(agendaList, today, days): hanya acara yang masih
//     berlangsung/mendatang dalam horizon, terurut menaik, subset dari input.

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

let buildAgendaIndex, filterUpcomingAgenda, toISODateLocal;

beforeAll(async () => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  }
  // checkAuth() top-level memanggil fetch('/api/me'); beri respons jinak.
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ nama: '', role: '' }) });
  const mod = await import('../src/js/main.js');
  buildAgendaIndex = mod.buildAgendaIndex;
  filterUpcomingAgenda = mod.filterUpcomingAgenda;
  toISODateLocal = mod.toISODateLocal;
});

// Tanggal lokal valid (hari 1-28 agar selalu valid di semua bulan).
const dateArb = fc
  .record({ y: fc.integer({ min: 2018, max: 2032 }), m: fc.integer({ min: 0, max: 11 }), d: fc.integer({ min: 1, max: 28 }) })
  .map(({ y, m, d }) => new Date(y, m, d));

function isoFromDate(dt) {
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Agenda: tgl_mulai acak, tgl_selesai null atau start + [0..5] hari.
const agendaArb = fc
  .record({
    id: fc.integer({ min: 1, max: 100000 }),
    judul: fc.string({ minLength: 1, maxLength: 20 }),
    start: dateArb,
    span: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 5 })),
  })
  .map(({ id, judul, start, span }) => {
    const tgl_mulai = isoFromDate(start);
    let tgl_selesai = null;
    if (span !== null) {
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + span);
      tgl_selesai = isoFromDate(end);
    }
    return { id, judul, tgl_mulai, tgl_selesai };
  });

// Enumerasi tanggal ISO yang dicakup sebuah agenda (oracle independen).
function coveredDates(a) {
  const out = [];
  const [ys, ms, ds] = a.tgl_mulai.split('-').map(Number);
  const start = new Date(ys, ms - 1, ds);
  const endIso = a.tgl_selesai || a.tgl_mulai;
  const [ye, me, de] = endIso.split('-').map(Number);
  const end = new Date(ye, me - 1, de);
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 500) {
    out.push(isoFromDate(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    guard++;
  }
  return out;
}

describe('buildAgendaIndex — agenda bebas sebagai entri "acara"', () => {
  it('menambahkan entri acara pada tiap tanggal cakupan; tanggal hanya dari data agenda', () => {
    fc.assert(
      fc.property(dateArb, fc.array(agendaArb, { maxLength: 8 }), (today, agendaList) => {
        const index = buildAgendaIndex([], [], today, agendaList);

        // Semua tanggal cakupan dari data agenda punya entri 'acara' berlabel judul.
        for (const a of agendaList) {
          for (const iso of coveredDates(a)) {
            const items = index.get(iso) || [];
            const acara = items.filter((x) => x.tipe === 'acara');
            expect(acara.some((x) => x.label === String(a.judul))).toBe(true);
          }
        }

        // Setiap entri 'acara' pada index tanggalnya berasal dari salah satu agenda.
        const validDates = new Set();
        agendaList.forEach((a) => coveredDates(a).forEach((iso) => validDates.add(iso)));
        for (const [iso, items] of index) {
          for (const it of items) {
            if (it.tipe === 'acara') {
              expect(validDates.has(iso)).toBe(true);
              expect(it.tanggal).toBe(iso);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('backward-compatible: tanpa argumen agenda, tidak ada entri "acara"', () => {
    fc.assert(
      fc.property(dateArb, (today) => {
        const index = buildAgendaIndex([], [], today);
        for (const [, items] of index) {
          for (const it of items) {
            expect(it.tipe).not.toBe('acara');
          }
        }
      }),
      { numRuns: 50 }
    );
  });
});

describe('filterUpcomingAgenda — acara mendatang dalam horizon, terurut', () => {
  it('hanya acara dengan end>=hari ini & start<=horizon, terurut menaik, subset input', () => {
    fc.assert(
      fc.property(dateArb, fc.array(agendaArb, { maxLength: 12 }), fc.integer({ min: 1, max: 120 }), (today, agendaList, days) => {
        const out = filterUpcomingAgenda(agendaList, today, days);
        const todayIso = toISODateLocal(today);
        const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
        const horizonIso = toISODateLocal(horizon);

        // Setiap hasil memenuhi predikat.
        for (const a of out) {
          const endIso = a.tgl_selesai || a.tgl_mulai;
          expect(endIso >= todayIso).toBe(true);
          expect(a.tgl_mulai <= horizonIso).toBe(true);
        }

        // Terurut menaik berdasarkan tgl_mulai.
        for (let i = 1; i < out.length; i++) {
          expect(out[i - 1].tgl_mulai <= out[i].tgl_mulai).toBe(true);
        }

        // Subset: setiap hasil ada di input.
        for (const a of out) {
          expect(agendaList.includes(a)).toBe(true);
        }

        // Kelengkapan: item input yang memenuhi predikat pasti ikut terpilih.
        const expectedCount = agendaList.filter((a) => {
          const endIso = a.tgl_selesai || a.tgl_mulai;
          return endIso >= todayIso && a.tgl_mulai <= horizonIso;
        }).length;
        expect(out.length).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it('input non-array aman → mengembalikan array kosong', () => {
    for (const bad of [null, undefined, 42, 'x', {}]) {
      expect(filterUpcomingAgenda(bad, new Date(), 30)).toEqual([]);
    }
  });
});
