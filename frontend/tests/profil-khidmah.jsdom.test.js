// Feature: santri-pengabdian-khidmah, Task 11.4: Example test jsdom detail profil
// Validates: Requirements 6.2, 7.4
//
// Example-based jsdom test (NOT a property test). It builds the khidmah-related
// DOM from profil-santri.html into the jsdom document, stubs the global
// checkAuth() that profil_santri.js calls at module load, dynamically imports
// the module, then drives populateBiodata() with a 'pengabdian' santri object.
//
// Assertions target two acceptance criteria for the detail profile:
//   - Req 6.2: while status is 'pengabdian', the detail profile shows the
//     khidmah tempat (place of service) near the status badge.
//   - Req 7.4: when khidmah_selesai is empty, the "Tanggal Selesai" field
//     renders as "-".

import { describe, it, expect, beforeEach } from 'vitest';

// The profil-santri detail page builds these element references at module load
// (top-level consts) and wires click handlers on the tab buttons + back button,
// so every id below must exist in the document BEFORE the module is imported.
// This mirrors the id set in frontend/profil-santri.html.
function buildProfilDom() {
  document.body.innerHTML = `
    <div id="loading-indicator"></div>
    <div id="profil-content" class="hidden">
      <img id="p-foto" />
      <h2 id="p-nama">-</h2>
      <span id="p-stambuk">-</span>
      <span id="p-status">Aktif</span>
      <span id="p-khidmah-tempat" class="hidden"></span>
      <span id="p-kelas-now">-</span>

      <div id="p-nik">-</div>
      <div id="p-ttl">-</div>
      <div id="p-wali">-</div>
      <div id="p-no-hp">-</div>
      <div id="p-alamat">-</div>

      <nav>
        <button id="tab-biodata">Biodata Lengkap</button>
        <button id="tab-akademik">Riwayat Akademik</button>
      </nav>
      <div id="content-biodata"></div>
      <div id="content-akademik" class="hidden"></div>

      <!-- Riwayat Pengabdian (Khidmah) — hidden until santri has khidmah data. -->
      <div id="riwayat-pengabdian-card" class="hidden">
        <div id="p-khidmah-tempat-detail">-</div>
        <div id="p-khidmah-status">-</div>
        <div id="p-khidmah-mulai">-</div>
        <div id="p-khidmah-selesai">-</div>
      </div>

      <div id="riwayat-container"></div>
      <div id="riwayat-empty" class="hidden"></div>
    </div>
    <button id="btn-back">Kembali</button>
  `;
}

// profil_santri.js calls checkAuth() at the top level to populate the navbar.
// It is provided globally on real pages; stub it so the import does not throw.
globalThis.checkAuth = () => {};

// Import once the DOM + global stub are in place. Cached across tests, which is
// fine because populateBiodata is a pure DOM writer driven by its argument.
let mod;
beforeEach(async () => {
  buildProfilDom();
  if (!mod) {
    mod = await import('../src/js/profil_santri.js');
  }
});

describe('detail profil santri pengabdian (Req 6.2, 7.4)', () => {
  it('Req 6.2: shows the khidmah tempat badge for a pengabdian santri', () => {
    mod.populateBiodata({
      nama: 'Aisyah',
      stambuk: 'STB-0042',
      status: 'pengabdian',
      khidmah_tempat: 'Pondok Pusat',
      khidmah_mulai: '2025-07-01',
      khidmah_selesai: null,
    });

    // Status badge reads "Pengabdian", not "Aktif"/"Alumni".
    expect(document.getElementById('p-status').textContent).toBe('Pengabdian');

    // Req 6.2: the khidmah tempat badge is revealed and names the place.
    const badge = document.getElementById('p-khidmah-tempat');
    expect(badge.classList.contains('hidden')).toBe(false);
    expect(badge.textContent).toContain('Pondok Pusat');
  });

  it('Req 7.4: renders empty khidmah_selesai as "-" in the riwayat pengabdian block', () => {
    mod.populateBiodata({
      nama: 'Aisyah',
      stambuk: 'STB-0042',
      status: 'pengabdian',
      khidmah_tempat: 'Pondok Pusat',
      khidmah_mulai: '2025-07-01',
      khidmah_selesai: null,
    });

    // The riwayat pengabdian card is shown because khidmah_tempat is filled.
    const card = document.getElementById('riwayat-pengabdian-card');
    expect(card.classList.contains('hidden')).toBe(false);

    // Tempat and status render; ongoing khidmah => "Berlangsung".
    expect(document.getElementById('p-khidmah-tempat-detail').textContent).toBe('Pondok Pusat');
    expect(document.getElementById('p-khidmah-status').textContent).toBe('Berlangsung');

    // Req 7.4: empty khidmah_selesai renders as "-".
    expect(document.getElementById('p-khidmah-selesai').textContent).toBe('-');

    // Sanity: a filled khidmah_mulai does NOT render as "-".
    expect(document.getElementById('p-khidmah-mulai').textContent).not.toBe('-');
  });
});
