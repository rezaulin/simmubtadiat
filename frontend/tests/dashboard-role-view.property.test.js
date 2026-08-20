// Feature: dashboard-redesign-kalender, Property 10: Pemetaan peran ke himpunan widget
// Validates: Requirements 4.1, 4.2, 4.5, 7.6
//
// resolveDashboardView(role) memetakan peran pengguna ke tampilan dashboard:
//   - Peran_Admin (pimpinan/admin/mufatish) -> 'admin'
//   - Peran_Guru  (mustahiq/muroqib)       -> 'guru'
//   - peran lain / tak dikenal              -> 'unknown'
//
// Himpunan widget yang menyertai tiap tampilan (sesuai Req 4.1/4.2/4.5):
//   - admin   : memuat Widget_Statistik, Grafik_Tingkatan, Grafik_Status, Kalender_Agenda
//   - guru    : widget teratas Jadwal_Hari_Ini; TIDAK memuat statistik/grafik
//   - unknown : himpunan widget kosong
//
// main.js memiliki efek samping top-level (membaca window.matchMedia dan
// menyentuh document). Kita menyiapkan stub matchMedia sebelum meng-import
// modul secara dinamis agar import tidak melempar error di lingkungan jsdom.

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';

let resolveDashboardView;

beforeAll(async () => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({
      matches: false,
      media: '',
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() { return false; },
    });
  }
  ({ resolveDashboardView } = await import('../src/js/main.js'));
});

// Peran kanonik aplikasi dari MENU_ACCESS (xss.js) + fc.string() untuk peran
// tak dikenal (termasuk string acak dan yang tidak cocok peran mana pun).
const roleArb = fc.oneof(
  fc.constantFrom('pimpinan', 'admin', 'mufatish', 'mustahiq', 'muroqib', 'tim_rapot', 'keamanan', 'wali_santri'),
  fc.string()
);

const ADMIN_ROLES = new Set(['pimpinan', 'admin', 'mufatish']);
const GURU_ROLES = new Set(['mustahiq', 'muroqib']);

// Oracle: himpunan widget untuk sebuah tampilan.
function widgetSetFor(view) {
  if (view === 'admin') {
    return new Set(['Widget_Statistik', 'Grafik_Tingkatan', 'Grafik_Status', 'Kalender_Agenda']);
  }
  if (view === 'guru') {
    // Widget teratas Jadwal_Hari_Ini + Kalender_Agenda; tanpa statistik/grafik.
    return new Set(['Jadwal_Hari_Ini', 'Kalender_Agenda']);
  }
  return new Set();
}

describe('Property 10: pemetaan peran ke himpunan widget', () => {
  it('memetakan setiap peran ke tampilan dan himpunan widget yang benar', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        const view = resolveDashboardView(role);

        // 1) Resolusi tampilan sesuai kelompok peran.
        if (ADMIN_ROLES.has(role)) {
          expect(view).toBe('admin');
        } else if (GURU_ROLES.has(role)) {
          expect(view).toBe('guru');
        } else {
          expect(view).toBe('unknown');
        }

        // Nilai keluaran selalu salah satu dari tiga tampilan valid.
        expect(['admin', 'guru', 'unknown']).toContain(view);

        // 2) Himpunan widget yang menyertai tampilan.
        const widgets = widgetSetFor(view);

        if (view === 'admin') {
          // Req 4.1: admin memuat statistik + kedua grafik + kalender.
          expect(widgets.has('Widget_Statistik')).toBe(true);
          expect(widgets.has('Grafik_Tingkatan')).toBe(true);
          expect(widgets.has('Grafik_Status')).toBe(true);
          expect(widgets.has('Kalender_Agenda')).toBe(true);
        } else if (view === 'guru') {
          // Req 4.2: guru menampilkan Jadwal_Hari_Ini teratas dan TIDAK
          // menampilkan statistik/grafik.
          expect(widgets.has('Jadwal_Hari_Ini')).toBe(true);
          expect(widgets.has('Widget_Statistik')).toBe(false);
          expect(widgets.has('Grafik_Tingkatan')).toBe(false);
          expect(widgets.has('Grafik_Status')).toBe(false);
        } else {
          // Req 4.5: peran tak dikenal -> tidak ada widget.
          expect(widgets.size).toBe(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});
