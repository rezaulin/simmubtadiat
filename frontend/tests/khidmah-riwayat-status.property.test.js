// Feature: santri-pengabdian-khidmah, Property 9: Status riwayat pengabdian Berlangsung/Selesai.
// Untuk setiap santri yang memiliki data khidmah (khidmah_tempat terisi), fungsi
// penentu status riwayat pengabdian (khidmahRiwayatStatus) menghasilkan
// "Berlangsung" JIKA statusnya "pengabdian" dan "Selesai" untuk status lainnya
// (termasuk "lulus" yang pernah berkhidmah).
// Validates: Requirements 7.1, 7.2, 7.3

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// profil_santri.js memiliki efek samping di top-level: memasang event listener
// pada elemen #tab-biodata / #tab-akademik / #btn-back dan memanggil checkAuth().
// Sediakan elemen dan stub global tersebut sebelum mengimpor modulnya (dynamic
// import agar setup DOM berjalan lebih dulu). Setup ini mengikuti pola
// profil-status-label.property.test.js (Property 8).
let khidmahRiwayatStatus;

beforeAll(async () => {
  document.body.innerHTML = `
    <div id="tab-biodata"></div>
    <div id="tab-akademik"></div>
    <button id="btn-back"></button>
  `;
  globalThis.checkAuth = () => {};

  const mod = await import('../src/js/profil_santri.js');
  khidmahRiwayatStatus = mod.khidmahRiwayatStatus;
});

describe('Property 9: khidmahRiwayatStatus — "Berlangsung" iff status "pengabdian", selain itu "Selesai"', () => {
  it('menghasilkan "Berlangsung" jika dan hanya jika status === "pengabdian"', () => {
    const statusArb = fc.oneof(
      // Status DB yang valid (huruf kecil, sesuai constraint santri.status).
      fc.constantFrom('pengabdian', 'aktif', 'lulus', 'cuti', 'boyong', 'keluar'),
      // Status tak dikenal / acak.
      fc.string()
    );

    fc.assert(
      fc.property(statusArb, (status) => {
        const result = khidmahRiwayatStatus(status);
        if (status === 'pengabdian') {
          expect(result).toBe('Berlangsung');
        } else {
          expect(result).toBe('Selesai');
        }
      }),
      { numRuns: 300 }
    );
  });

  it('status "lulus" (pernah berkhidmah) menghasilkan "Selesai"', () => {
    expect(khidmahRiwayatStatus('lulus')).toBe('Selesai');
  });

  it('status "pengabdian" menghasilkan "Berlangsung"', () => {
    expect(khidmahRiwayatStatus('pengabdian')).toBe('Berlangsung');
  });
});
