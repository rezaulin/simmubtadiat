// Feature: dashboard-redesign-kalender, Task 8.2 — Interaction tests (jsdom) untuk
// lapisan orkestrasi jaringan & status pada `frontend/src/js/main.js`.
//
// Ini adalah example-based interaction tests (BUKAN property tests). Test memuat
// fungsi orkestrasi `load*` yang diekspor dari main.js, memberi elemen target
// eksplisit (parameter opsional), lalu mengendalikan `globalThis.fetch` untuk
// menyimulasikan kondisi pending / sukses / gagal, dan memverifikasi:
//
//   - Indikator loading tampil selama permintaan berjalan (Req 5.2).
//   - Kegagalan widget menampilkan pesan error + tombol "Muat ulang" (Req 5.9, 7.7).
//   - Isolasi kegagalan antar widget: satu endpoint gagal, endpoint lain sukses;
//     widget yang sukses tetap terender sementara yang gagal menampilkan error
//     (Req 7.7).
//   - Degradasi Kalender_Agenda saat sumber gagal: strip minggu tetap tampil tanpa
//     titik penanda maupun daftar agenda, plus pesan kegagalan + "Muat ulang"
//     (Req 6.2).
//
// Validates: Requirements 5.2, 5.9, 6.2, 7.7
//
// main.js memiliki efek samping top-level: membaca window.matchMedia (Apply dark
// mode), memanggil checkAuth() (fetch('/api/me')) dan startHeroClock(). Karena itu
// kita memasang stub window.matchMedia dan globalThis.fetch SEBELUM mengimpor modul
// (dynamic import). Saat import, document.body belum memuat anchor dashboard,
// sehingga checkAuth() & startHeroClock() tidak mengorkestrasi widget apa pun.
// Mengikuti pola alumni-tabs.jsdom.test.js & drawer.interaction.test.js.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// window.matchMedia tidak tersedia di jsdom; main.js (dan xss.js yang diimpornya)
// mengevaluasinya di top-level. Stub minimal yang mengembalikan matches:false.
function installMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    });
  }
}

// Response-like sederhana menyerupai objek Response fetch (punya .ok & .json()).
function jsonResponse(data, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(data) });
}

// fetch yang tak pernah selesai (pending selamanya) untuk menguji indikator loading.
function pendingFetch() {
  return new Promise(() => {});
}

let main;

beforeAll(async () => {
  installMatchMedia();
  // Default fetch aman untuk efek samping top-level (checkAuth → /api/me).
  // Saat import, tidak ada anchor dashboard di DOM, jadi initRoleAwareDashboard
  // keluar lebih awal dan tidak ada widget yang diorkestrasi.
  globalThis.fetch = vi.fn(() => jsonResponse({ role: 'admin', nama: 'Tester' }));
  main = await import('../src/js/main.js');
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// Helper: buat elemen target terlepas (detached) untuk dipass ke fungsi load*.
function makeTarget() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('Task 8.2 — orkestrasi loading, isolasi kegagalan & degradasi (jsdom)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('Req 5.2: indikator loading tampil selama permintaan Widget_Statistik berjalan', () => {
    // fetch pending → permintaan tak pernah selesai.
    globalThis.fetch = vi.fn(pendingFetch);
    const el = makeTarget();

    // Tidak di-await: loadStats menyetel markup loading secara sinkron sebelum
    // menunggu (await) respons fetch.
    main.loadStats(el);

    const loading = el.querySelector('[data-loading]');
    expect(loading).toBeTruthy();
    // Belum ada kartu metrik maupun error selama masih memuat.
    expect(el.querySelector('[data-metric-card]')).toBeNull();
    expect(el.querySelector('[data-error]')).toBeNull();
  });

  it('Req 5.2: indikator loading tampil selama permintaan Jadwal_Hari_Ini berjalan', () => {
    globalThis.fetch = vi.fn(pendingFetch);
    const el = makeTarget();

    main.loadJadwalHariIni(el);

    expect(el.querySelector('[data-loading]')).toBeTruthy();
    expect(el.querySelector('[data-jadwal-card]')).toBeNull();
    expect(el.querySelector('[data-error]')).toBeNull();
  });

  it('Req 5.9: kegagalan Jadwal_Hari_Ini menampilkan pesan error + tombol "Muat ulang"', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    const el = makeTarget();

    await main.loadJadwalHariIni(el);

    const error = el.querySelector('[data-error]');
    const retry = el.querySelector('[data-retry]');
    expect(error).toBeTruthy();
    expect(retry).toBeTruthy();
    expect(retry.textContent).toContain('Muat ulang');
    expect(error.textContent.toLowerCase()).toContain('jadwal');
  });

  it('Req 5.9/7.7: tombol "Muat ulang" memicu permintaan ulang', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('network down')));
    globalThis.fetch = fetchMock;
    const el = makeTarget();

    await main.loadJadwalHariIni(el);
    const callsAfterFirst = fetchMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThanOrEqual(1);

    // Klik tombol muat ulang → memanggil loadJadwalHariIni lagi (fetch dipanggil lagi).
    el.querySelector('[data-retry]').click();
    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });

  it('Req 7.7: kegagalan satu widget tidak menjatuhkan widget lain (isolasi)', async () => {
    // Router: /api/pengajar GAGAL, /api/santri SUKSES.
    const santri = [
      { tingkatan_nama: 'Ula', status: 'aktif' },
      { tingkatan_nama: 'Ula', status: 'pengabdian' },
      { tingkatan_nama: 'Wustho', status: 'aktif' },
    ];
    globalThis.fetch = vi.fn((url) => {
      const u = String(url);
      if (u === '/api/pengajar') return Promise.reject(new Error('pengajar down'));
      if (u === '/api/santri') return jsonResponse(santri);
      return jsonResponse({});
    });

    const pengajarEl = makeTarget();
    const tingkatanEl = makeTarget();
    const statusEl = makeTarget();

    await Promise.all([
      main.loadPengajar(pengajarEl),
      main.loadSantriCharts({ tingkatan: tingkatanEl, status: statusEl }),
    ]);

    // Widget yang gagal (pengajar) menampilkan error + retry.
    expect(pengajarEl.querySelector('[data-error]')).toBeTruthy();
    expect(pengajarEl.querySelector('[data-retry]')).toBeTruthy();

    // Widget yang sukses (grafik) tetap terender, TIDAK menampilkan error.
    expect(tingkatanEl.querySelector('[data-chart="tingkatan"]')).toBeTruthy();
    expect(tingkatanEl.querySelector('[data-error]')).toBeNull();
    expect(statusEl.querySelector('[data-chart="status"]')).toBeTruthy();
    expect(statusEl.querySelector('[data-error]')).toBeNull();
  });

  it('Req 7.7: isolasi arah sebaliknya — grafik gagal, ringkasan pengajar sukses', async () => {
    globalThis.fetch = vi.fn((url) => {
      const u = String(url);
      if (u === '/api/santri') return Promise.reject(new Error('santri down'));
      if (u === '/api/pengajar') return jsonResponse([{ id: 1 }, { id: 2 }]);
      return jsonResponse({});
    });

    const pengajarEl = makeTarget();
    const tingkatanEl = makeTarget();
    const statusEl = makeTarget();

    await Promise.all([
      main.loadPengajar(pengajarEl),
      main.loadSantriCharts({ tingkatan: tingkatanEl, status: statusEl }),
    ]);

    // Grafik gagal → error pada kedua kontainer grafik.
    expect(tingkatanEl.querySelector('[data-error]')).toBeTruthy();
    expect(statusEl.querySelector('[data-error]')).toBeTruthy();

    // Ringkasan pengajar tetap terender dengan nilai (2 pengajar), tanpa error.
    expect(pengajarEl.querySelector('[data-ringkasan="pengajar"]')).toBeTruthy();
    expect(pengajarEl.querySelector('[data-error]')).toBeNull();
    expect(pengajarEl.querySelector('[data-pengajar-value]').textContent).toBe('2');
  });

  it('Req 6.2: Kalender_Agenda terdegradasi saat sumber gagal — strip minggu tanpa titik & daftar', async () => {
    // /api/kalender GAGAL → degradasi (Promise.all menolak).
    globalThis.fetch = vi.fn((url) => {
      const u = String(url);
      if (u === '/api/kalender') return Promise.reject(new Error('kalender down'));
      if (u === '/api/kalender/tahun') return jsonResponse([]);
      if (u === '/api/akademik/jadwal-saya-hari-ini') return jsonResponse({ jadwal: [] });
      return jsonResponse({});
    });

    const el = makeTarget();
    await main.loadKalenderAgenda(el, new Date(2025, 0, 15));

    // Mode degradasi ditandai [data-degraded].
    expect(el.querySelector('[data-degraded]')).toBeTruthy();
    // Strip minggu tetap tampil: tepat tujuh sel.
    expect(el.querySelectorAll('[data-week-cell]').length).toBe(7);
    // Tanpa titik penanda agenda apa pun.
    expect(el.querySelector('[data-agenda-dot]')).toBeNull();
    // Pesan kegagalan + tombol "Muat ulang".
    const retry = el.querySelector('[data-retry]');
    expect(retry).toBeTruthy();
    expect(retry.textContent).toContain('Muat ulang');
  });

  it('Req 6.2: Kalender_Agenda sukses menampilkan strip minggu 7 hari (kontras degradasi)', async () => {
    // Semua sumber sukses; hari ini punya jadwal → ada titik penanda.
    globalThis.fetch = vi.fn((url) => {
      const u = String(url);
      if (u === '/api/kalender') return jsonResponse([
        { kuartal: 1, tahun_ajaran: '2024/2025', tgl_mulai: '2025-01-15', tgl_selesai: '2025-03-31' },
      ]);
      if (u === '/api/kalender/tahun') return jsonResponse([]);
      if (u === '/api/akademik/jadwal-saya-hari-ini') return jsonResponse({ jadwal: [] });
      return jsonResponse({});
    });

    const el = makeTarget();
    await main.loadKalenderAgenda(el, new Date(2025, 0, 15));

    // Bukan mode degradasi; strip minggu 7 hari tetap ada.
    expect(el.querySelector('[data-degraded]')).toBeNull();
    expect(el.querySelectorAll('[data-week-cell]').length).toBe(7);
    // tgl_mulai kuartal (2025-01-15 = hari ini pada strip) memiliki titik penanda.
    expect(el.querySelector('[data-agenda-dot]')).toBeTruthy();
  });
});
