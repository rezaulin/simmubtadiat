// Feature: santri-pengabdian-khidmah, Property 8: Label status pengabdian pada detail profil.
// Untuk setiap Status_Santri, fungsi pemetaan status→label pada detail profil
// (profilStatusLabel) menghasilkan label "Pengabdian" JIKA DAN HANYA JIKA
// statusnya "pengabdian", dan label ini berbeda dari label status "aktif"
// maupun "lulus".
// Validates: Requirements 6.1

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

// profil_santri.js memiliki efek samping di top-level: memasang event listener
// pada elemen #tab-biodata / #tab-akademik / #btn-back dan memanggil checkAuth().
// Sediakan elemen dan stub global tersebut sebelum mengimpor modulnya (dynamic
// import agar setup DOM berjalan lebih dulu).
let statusMap;
let profilStatusLabel;

beforeAll(async () => {
  document.body.innerHTML = `
    <div id="tab-biodata"></div>
    <div id="tab-akademik"></div>
    <button id="btn-back"></button>
  `;
  globalThis.checkAuth = () => {};

  const mod = await import('../src/js/profil_santri.js');
  statusMap = mod.statusMap;
  profilStatusLabel = mod.profilStatusLabel;
});

describe('Property 8: profilStatusLabel — label "Pengabdian" iff status "pengabdian"', () => {
  it('menghasilkan "Pengabdian" jika dan hanya jika status === "pengabdian"', () => {
    // Kumpulan label yang sudah dipetakan. Fallback profilStatusLabel untuk
    // status tak dikenal mengembalikan status apa adanya; agar iff tetap
    // bermakna, string acak yang kebetulan sama persis dengan salah satu label
    // (mis. "Pengabdian") dikecualikan dari generator status tak dikenal.
    const labelValues = new Set(Object.values(statusMap).map((s) => s.label));

    const statusArb = fc.oneof(
      // Status DB yang valid (huruf kecil, sesuai constraint santri.status).
      fc.constantFrom('pengabdian', 'aktif', 'lulus', 'cuti', 'boyong', 'keluar'),
      // Status tak dikenal / acak.
      fc.string().filter((s) => !labelValues.has(s))
    );

    fc.assert(
      fc.property(statusArb, (status) => {
        const label = profilStatusLabel(status);
        const isPengabdian = status === 'pengabdian';
        // iff: label === 'Pengabdian'  ⇔  status === 'pengabdian'
        expect(label === 'Pengabdian').toBe(isPengabdian);
      }),
      { numRuns: 300 }
    );
  });

  it('label "Pengabdian" berbeda dari label "aktif" maupun "lulus"', () => {
    const pengabdianLabel = profilStatusLabel('pengabdian');
    expect(pengabdianLabel).toBe('Pengabdian');
    expect(pengabdianLabel).not.toBe(profilStatusLabel('aktif'));
    expect(pengabdianLabel).not.toBe(profilStatusLabel('lulus'));
  });
});
