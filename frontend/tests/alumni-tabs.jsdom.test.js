// Feature: santri-pengabdian-khidmah, Task 10.6 — Example test jsdom Halaman Alumni.
//
// Memverifikasi perilaku terintegrasi Halaman Alumni pada lingkungan jsdom:
//   1. Kedua tab ("Pengabdian" & "Alumni") termuat dan `switchTab` menoggle
//      kelas `hidden` pada kontainer #content-pengabdian / #content-alumni.
//      (Requirements 8.1, 8.4)
//   2. Tab Alumni tetap merender data alumni (tabel #table-body terisi lewat
//      alur checkAuth → loadAlumni → renderTable). (Requirement 8.4)
//   3. Submit modal "Selesai Khidmah" (#form-selesai) memicu POST ke
//      /api/pengabdian/selesai dengan payload {santri_id, khidmah_selesai}.
//      (Requirement 8.5)
//
// Validates: Requirements 8.1, 8.4, 8.5
//
// alumni.js memiliki banyak efek samping di top-level: ia mengambil elemen via
// getElementById, memanggil `.addEventListener` pada sebagian di antaranya, lalu
// memanggil checkAuth() (fetch('/api/me')). Karena itu kita membangun struktur
// DOM alumni.html yang cukup lengkap DAN memasang stub global (matchMedia,
// isPimpinanRole/isAdminRole) serta mock fetch yang terkontrol SEBELUM mengimpor
// modul (dynamic import), mengikuti pola pengabdian-row.property.test.js (task 10.4).

import { describe, it, expect, beforeAll, vi } from 'vitest';

let switchTab;
let fetchMock;

// Data yang dikembalikan mock fetch untuk membuat checkAuth() menuntaskan
// pemuatan tab Alumni & tab Pengabdian.
const alumniData = [
  { id: 1, nama: 'Alumni Satu', stambuk: 'STB-1', status_akhir: 'lulus', tingkatan_akhir: 'Aliyah', asal_daerah: 'Kota A' },
  { id: 2, nama: 'Alumni Dua', stambuk: 'STB-2', status_akhir: 'boyong', tingkatan_akhir: 'Wustho', asal_daerah: 'Kota B' },
];
const pengabdianData = [
  { id: 10, nama: 'Santri Khidmah', stambuk: 'STB-10', khidmah_tempat: 'Dapur Umum', khidmah_mulai: '2025-07-01' },
];

// Response-like sederhana yang menyerupai objek Response fetch (punya .ok & .json()).
function jsonResponse(data, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(data) });
}

// Router mock fetch berdasarkan URL yang dipanggil modul saat checkAuth &
// interaksi. Semua rute mengembalikan objek Response-like.
function routeFetch(url) {
  const u = String(url);
  if (u === '/api/me') return jsonResponse({ role: 'admin' });
  if (u.startsWith('/api/alumni')) return jsonResponse(alumniData);
  if (u === '/api/santri') return jsonResponse([]);
  if (u.startsWith('/api/wilayah/provinsi')) return jsonResponse([]);
  if (u.startsWith('/api/wilayah/kabupaten')) return jsonResponse([]);
  if (u === '/api/pengabdian') return jsonResponse(pengabdianData);
  if (u === '/api/pengabdian/selesai') return jsonResponse({ status: 'success', message: 'Berhasil' });
  return jsonResponse({});
}

beforeAll(async () => {
  // Struktur DOM cukup lengkap dari alumni.html: elemen tab & modal, plus semua
  // ID yang dirujuk alumni.js pada saat load (termasuk yang di-addEventListener
  // tanpa penjaga null seperti search-input, btn-tambah, modal-*, form-*).
  document.body.innerHTML = `
    <button id="btn-tambah" class="hidden"></button>

    <!-- Tabs -->
    <button id="tab-pengabdian" type="button"></button>
    <button id="tab-alumni" type="button"></button>

    <!-- Tab content: Pengabdian -->
    <div id="content-pengabdian" class="hidden">
      <div id="pengabdian-list"></div>
    </div>

    <!-- Tab content: Alumni -->
    <div id="content-alumni">
      <select id="filter-provinsi"></select>
      <select id="filter-kabupaten"></select>
      <button id="btn-reset-filter"></button>
      <input id="search-input" />
      <table><tbody id="table-body"></tbody></table>
    </div>

    <!-- Modal Proses Keluar (id di HTML tetap modal-santri) -->
    <div id="modal-santri" class="hidden">
      <div id="modal-content"></div>
      <div id="modal-overlay"></div>
      <button id="modal-close"></button>
      <button id="btn-cancel"></button>
      <form id="form-alumni">
        <input name="tanggal_keluar" type="date" />
        <input id="input-santri-nama" />
        <datalist id="santri-datalist"></datalist>
        <input id="santri-id-hidden" />
        <div id="kelas-akhir-choice" class="hidden">
          <input type="radio" name="pengabdian_choice" value="alumni" checked />
          <input type="radio" name="pengabdian_choice" value="khidmah" />
        </div>
        <div id="group-status-keluar"><select id="select-status-akhir"></select></div>
        <div id="group-tanggal-keluar"><input id="input-tanggal-keluar" type="date" /></div>
        <div id="khidmah-fields" class="hidden">
          <input id="input-khidmah-tempat" />
          <input id="input-khidmah-mulai" type="date" />
        </div>
        <div id="modal-error" class="hidden"></div>
        <button type="submit"></button>
      </form>
    </div>

    <!-- Modal Detail -->
    <div id="modal-detail" class="hidden">
      <div id="modal-detail-content"></div>
      <div id="modal-detail-overlay"></div>
      <button id="modal-detail-close"></button>
      <form id="form-update-alumni">
        <input id="detail-id" />
        <span id="detail-nama"></span>
        <span id="detail-stambuk"></span>
        <span id="detail-status"></span>
        <input id="input-khidmah" />
        <input id="input-ijazah" />
      </form>
    </div>

    <!-- Modal Selesai Khidmah -->
    <div id="modal-selesai" class="hidden">
      <div id="modal-selesai-content"></div>
      <div id="modal-selesai-overlay"></div>
      <button id="modal-selesai-close"></button>
      <button id="btn-selesai-cancel"></button>
      <form id="form-selesai">
        <input type="hidden" id="selesai-santri-id" name="santri_id" />
        <input type="date" id="input-khidmah-selesai" name="khidmah_selesai" />
        <span id="selesai-nama"></span>
        <div id="modal-selesai-error" class="hidden"></div>
        <button type="submit"></button>
      </form>
    </div>
  `;

  // alumni.js mengevaluasi window.matchMedia(...) di top-level (Apply Theme);
  // jsdom tidak menyediakannya, jadi sediakan stub.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  }

  // Gating tombol tulis (checkAuth, canShowSelesaiKhidmah, tombol Edit) kini
  // memakai window.isPimpinanRole — admin bersifat read-only sehingga dengan
  // role 'admin' tombol tulis TIDAK tampil, namun data alumni tetap dimuat.
  // isAdminRole tetap disediakan untuk kompatibilitas helper lain.
  globalThis.isPimpinanRole = (role) => role === 'pimpinan';
  window.isPimpinanRole = globalThis.isPimpinanRole;
  globalThis.isAdminRole = (role) => role === 'pimpinan' || role === 'admin';
  window.isAdminRole = globalThis.isAdminRole;

  // Mock fetch terkontrol: menangani semua rute yang dipanggil modul, sekaligus
  // merekam pemanggilan sehingga submit POST dapat diperiksa.
  fetchMock = vi.fn(routeFetch);
  globalThis.fetch = fetchMock;

  // Import modul: setup DOM & stub di atas harus sudah siap lebih dulu.
  const mod = await import('../src/js/alumni.js');
  switchTab = mod.default?.switchTab || window.switchTab;

  // checkAuth() berjalan async saat load: tunggu hingga tab Alumni terender
  // (renderTable mengisi #table-body dengan satu <tr> per alumni).
  await vi.waitFor(() => {
    expect(document.querySelectorAll('#table-body tr').length).toBe(alumniData.length);
  });
});

describe('Task 10.6 — Halaman Alumni (jsdom)', () => {
  it('kedua tab termuat dan switchTab menoggle kelas hidden (Req 8.1, 8.4)', () => {
    const tabPengabdian = document.getElementById('tab-pengabdian');
    const tabAlumni = document.getElementById('tab-alumni');
    const contentPengabdian = document.getElementById('content-pengabdian');
    const contentAlumni = document.getElementById('content-alumni');

    expect(tabPengabdian).toBeTruthy();
    expect(tabAlumni).toBeTruthy();
    expect(contentPengabdian).toBeTruthy();
    expect(contentAlumni).toBeTruthy();

    // Aktifkan tab Pengabdian → content-pengabdian tampil, content-alumni tersembunyi.
    switchTab('pengabdian');
    expect(contentPengabdian.classList.contains('hidden')).toBe(false);
    expect(contentAlumni.classList.contains('hidden')).toBe(true);

    // Kembali ke tab Alumni → content-alumni tampil, content-pengabdian tersembunyi.
    switchTab('alumni');
    expect(contentAlumni.classList.contains('hidden')).toBe(false);
    expect(contentPengabdian.classList.contains('hidden')).toBe(true);
  });

  it('tab Alumni tetap merender data alumni (Req 8.4)', () => {
    switchTab('alumni');
    const rows = document.querySelectorAll('#table-body tr');
    expect(rows.length).toBe(alumniData.length);
    const bodyText = document.getElementById('table-body').textContent;
    expect(bodyText).toContain('Alumni Satu');
    expect(bodyText).toContain('Alumni Dua');
  });

  it('tab Pengabdian merender daftar santri pengabdian', () => {
    switchTab('pengabdian');
    const listText = document.getElementById('pengabdian-list').textContent;
    expect(listText).toContain('Santri Khidmah');
    expect(listText).toContain('Dapur Umum');
  });

  it('submit modal "Selesai Khidmah" memanggil POST /api/pengabdian/selesai (Req 8.5)', async () => {
    // Isi field modal seperti setelah pengguna mengonfirmasi tanggal selesai.
    document.getElementById('selesai-santri-id').value = '10';
    document.getElementById('input-khidmah-selesai').value = '2026-07-01';

    const form = document.getElementById('form-selesai');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Tunggu handler async memanggil fetch dengan endpoint selesai.
    await vi.waitFor(() => {
      const called = fetchMock.mock.calls.some((c) => String(c[0]) === '/api/pengabdian/selesai');
      expect(called).toBe(true);
    });

    const call = fetchMock.mock.calls.find((c) => String(c[0]) === '/api/pengabdian/selesai');
    expect(call).toBeTruthy();
    // Metode POST dengan body JSON payload yang benar.
    expect(call[1]).toBeTruthy();
    expect(call[1].method).toBe('POST');
    const body = JSON.parse(call[1].body);
    expect(body.santri_id).toBe(10);
    expect(body.khidmah_selesai).toBe('2026-07-01');
  });
});
