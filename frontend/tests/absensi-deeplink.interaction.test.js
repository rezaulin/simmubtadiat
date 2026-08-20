// Feature: dashboard-redesign-kalender, Task 9.3: Interaction test — selectBagian
// dipanggil pada param valid.
// Validates: Requirements 5.6, 5.7
//
// These are example-based interaction tests (NOT property tests). absensi.js runs
// init() at import time: it fetches /api/me, awaits loadFilters(), then reads
// window.location.search via parseAbsensiQuery and — when the deep-link is valid —
// sets filterTanggal.value and calls the internal selectBagian(bagian) which drives
// the filter-kelas → filter-bagian cascade (Req 5.6). When the query is missing or
// invalid it leaves the form in its initial state and shows a "bagian belum dipilih"
// message in #empty-state (Req 5.7).
//
// selectBagian is NOT exported, so instead of spying on it we assert its observable
// effects: after a valid deep-link the tanggal input equals the query tanggal and the
// bagian cascade resolves (filter-kelas/filter-bagian get set to the deep-linked
// bagian). Because init() has heavy top-level side effects and only runs once per
// import, each scenario stubs matchMedia + fetch + window.location BEFORE importing,
// uses vi.resetModules() for isolation, and re-imports absensi.js per case.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A bagian whose id matches the deep-link, in a single tingkatan so the cascade
// resolves deterministically.
const BAGIAN = { id: 5, tingkatan_id: 1, nama_bagian: 'A', kelas: 'Pagi' };
const TINGKATAN = { id: 1, nama: 'Kelas 1' };

// Helper: a resolved fetch-like response.
function resp(data) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}

// URL-routed fetch stub covering every endpoint init()/loadFilters()/selectBagian()
// touch. bagian-saya is checked before bagian because it contains the substring.
function makeFetch(role) {
  return (url) => {
    const u = String(url);
    if (u.includes('/api/me')) return resp({ role, pengajar_id: 1 });
    if (u.includes('/api/akademik/tingkatan')) return resp([TINGKATAN]);
    if (u.includes('/api/akademik/bagian-saya')) return resp([BAGIAN]);
    if (u.includes('/api/akademik/bagian')) return resp([BAGIAN]);
    if (u.includes('/api/akademik/jadwal-saya-hari-ini')) return resp({ hari: 'Senin', jadwal: [] });
    // updateInfoKuartal(): return a kuartal that covers the deep-linked tanggal so
    // it takes the "found" branch cleanly.
    if (u.includes('/api/kalender')) {
      return resp([{ kuartal: 1, tahun_ajaran: '2024', tgl_mulai: '2024-01-01', tgl_selesai: '2024-12-31' }]);
    }
    if (u.includes('/api/santri/by-bagian')) return resp([]);
    return resp([]);
  };
}

// The canonical set of element IDs absensi.js queries (top-level + inside
// loadFilters/updateInfoKuartal/loadJadwalHariIni).
function buildAbsensiDom() {
  document.body.innerHTML = `
    <div id="filter-section">
      <select id="filter-kelas"></select>
      <select id="filter-bagian"></select>
      <input id="filter-tanggal" />
      <button id="btn-load"></button>
    </div>
    <div id="jadwal-hari-ini" class="hidden"></div>
    <div id="info-kuartal" class="hidden"><span id="info-kuartal-text"></span></div>
    <div id="table-container" class="hidden"></div>
    <div id="empty-state"></div>
    <tbody id="table-body"></tbody>
    <button id="btn-save-bulk" class="hidden"></button>
  `;
}

function stubMatchMedia() {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  });
}

// Sets window.location.search (read by parseAbsensiQuery) before import.
function setLocation(search) {
  window.history.replaceState({}, '', `/absensi.html${search}`);
}

// Prepares the environment then imports absensi.js fresh so init() runs against it.
async function bootAbsensi({ role = 'pimpinan', search }) {
  buildAbsensiDom();
  stubMatchMedia();
  globalThis.fetch = vi.fn(makeFetch(role));
  setLocation(search);
  vi.resetModules();
  await import('../src/js/absensi.js');
}

const filterKelas = () => document.getElementById('filter-kelas');
const filterBagian = () => document.getElementById('filter-bagian');
const filterTanggal = () => document.getElementById('filter-tanggal');
const emptyState = () => document.getElementById('empty-state');

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Req 5.6: valid deep-link drives selectBagian without extra interaction', () => {
  const TANGGAL = '2024-05-10';

  beforeEach(async () => {
    await bootAbsensi({ search: `?bagian=${BAGIAN.id}&tanggal=${TANGGAL}` });
    // init() is async and not awaited at module top-level; poll until the cascade
    // resolves (filter-bagian gets the deep-linked id).
    await vi.waitFor(() => {
      expect(filterBagian().value).toBe(String(BAGIAN.id));
    }, { timeout: 3000 });
  });

  it('sets filter-tanggal to the query tanggal', () => {
    expect(filterTanggal().value).toBe(TANGGAL);
  });

  it('runs the bagian cascade: filter-kelas set to the bagian tingkatan', () => {
    expect(filterKelas().value).toBe(String(BAGIAN.tingkatan_id));
  });

  it('selects the deep-linked bagian in filter-bagian', () => {
    expect(filterBagian().value).toBe(String(BAGIAN.id));
  });

  it('does not show the "bagian belum dipilih" initial-state message', () => {
    expect(emptyState().textContent).not.toMatch(/belum dipilih/i);
  });
});

describe('Req 5.7: invalid/missing query leaves the form in its initial state', () => {
  beforeEach(async () => {
    // No query params at all → parseAbsensiQuery returns valid=false.
    await bootAbsensi({ search: '' });
    await vi.waitFor(() => {
      expect(emptyState().textContent).toMatch(/belum dipilih/i);
    }, { timeout: 3000 });
  });

  it('shows the "bagian belum dipilih" message in #empty-state', () => {
    expect(emptyState().textContent).toMatch(/belum dipilih/i);
    expect(emptyState().classList.contains('hidden')).toBe(false);
  });

  it('leaves no bagian selected (form initial state)', () => {
    expect(filterBagian().value).toBe('');
  });

  it('leaves no kelas selected (form initial state)', () => {
    expect(filterKelas().value).toBe('');
  });
});

describe('Req 5.7: malformed query (bad tanggal) also stays in initial state', () => {
  beforeEach(async () => {
    // bagian present but tanggal is not a real calendar date → valid=false.
    await bootAbsensi({ search: `?bagian=${BAGIAN.id}&tanggal=2024-02-30` });
    await vi.waitFor(() => {
      expect(emptyState().textContent).toMatch(/belum dipilih/i);
    }, { timeout: 3000 });
  });

  it('shows the "bagian belum dipilih" message and selects no bagian', () => {
    expect(emptyState().textContent).toMatch(/belum dipilih/i);
    expect(filterBagian().value).toBe('');
  });
});
