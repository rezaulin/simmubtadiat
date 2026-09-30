import { describe, it, expect } from 'vitest';
import { MENU_ACCESS, computeAllowedLinks } from '../src/js/xss.js';

// Unit tests for Task 2.1: canonical MENU_ACCESS map and the pure
// computeAllowedLinks(role) function. Canonical values come from design.md
// (Data Models → MenuAccess). Requirements: 4.1, 4.2.
describe('MENU_ACCESS canonical map', () => {
  const ALL_PAGES = [
    '/index.html', '/santri.html', '/perpindahan.html', '/kelas.html',
    '/penilaian.html', '/absensi.html', '/absensi-manual.html', '/rapot.html', '/pengajar.html',
    '/dewan-harian.html', '/arsip.html', '/alumni.html',
    '/rekap.html', '/catatan.html', '/settings.html'
  ];

  it('defines exactly the six canonical roles', () => {
    expect(Object.keys(MENU_ACCESS).sort()).toEqual(
      ['admin', 'keamanan', 'mufatish', 'muroqib', 'mustahiq', 'pimpinan', 'tim_rapot', 'wali_santri']
    );
  });

  it('pimpinan and admin have full access including /settings.html', () => {
    expect(MENU_ACCESS.pimpinan).toEqual(ALL_PAGES);
    expect(MENU_ACCESS.admin).toEqual(ALL_PAGES);
  });

  it('mufatish: /rapot.html and /dewan-harian.html removed (permintaan role menu)', () => {
    expect(MENU_ACCESS.mufatish).toEqual(
      ['/index.html', '/santri.html', '/penilaian.html', '/absensi-manual.html', '/pengajar.html', '/arsip.html', '/rekap.html', '/catatan.html']
    );
  });

  it('mustahiq: /perpindahan, /rapot and /dewan-harian removed; + /arsip added (permintaan role menu)', () => {
    expect(MENU_ACCESS.mustahiq).toEqual(
      ['/index.html', '/santri.html', '/penilaian.html', '/rekap.html', '/catatan.html', '/pengajar.html', '/arsip.html']
    );
  });

  it('keamanan: + /pengajar-purna added (permintaan Role Mustahiq + Keamanan)', () => {
    expect(MENU_ACCESS.keamanan).toEqual(
      ['/index.html', '/santri.html', '/arsip.html', '/alumni.html', '/catatan.html', '/pengajar-purna.html']
    );
  });

  it('muroqib: /pengajar.html and /dewan-harian.html removed (permintaan role menu)', () => {
    expect(MENU_ACCESS.muroqib).toEqual(['/index.html', '/santri.html', '/absensi-manual.html', '/catatan.html', '/rekap.html']);
  });

  it('wali_santri has beranda & rapot only', () => {
    expect(MENU_ACCESS.wali_santri).toEqual(['/index.html', '/rapot.html']);
  });
});

describe('computeAllowedLinks(role)', () => {
  it('returns the canonical list for a known role', () => {
    expect(computeAllowedLinks('muroqib')).toEqual(MENU_ACCESS.muroqib);
  });

  it('returns an empty array for an unknown role', () => {
    expect(computeAllowedLinks('ghost')).toEqual([]);
  });

  it('returns an empty array for an empty/undefined role', () => {
    expect(computeAllowedLinks('')).toEqual([]);
    expect(computeAllowedLinks(undefined)).toEqual([]);
    expect(computeAllowedLinks(null)).toEqual([]);
  });
});

describe('Opsi C - /dewan-harian.html hanya utk kombinasi mustahiq+keamanan', () => {
  const DH = '/dewan-harian.html';

  it('mustahiq tunggal TIDAK mendapat Dewan Harian', () => {
    expect(computeAllowedLinks(['mustahiq'])).not.toContain(DH);
    expect(computeAllowedLinks('mustahiq')).not.toContain(DH);
  });

  it('keamanan tunggal TIDAK mendapat Dewan Harian', () => {
    expect(computeAllowedLinks(['keamanan'])).not.toContain(DH);
    expect(computeAllowedLinks('keamanan')).not.toContain(DH);
  });

  it('ganda mustahiq+keamanan MENDAPAT Dewan Harian (9 union + 1 combo = 10)', () => {
    const gda = computeAllowedLinks(['mustahiq', 'keamanan']);
    expect(gda).toContain(DH);
    expect(gda).toHaveLength(10);
  });

  it('kombinasi lain TIDAK mendapat (syarat AND harus dua-duanya)', () => {
    expect(computeAllowedLinks(['mufatish', 'keamanan'])).not.toContain(DH);
    expect(computeAllowedLinks(['mustahiq', 'mufatish'])).not.toContain(DH);
    expect(computeAllowedLinks(['mustahiq', 'keamanan', 'muroqib'])).toContain(DH);
  });

  it('pimpinan & admin tetap dapat lewat MENU_ACCESS (bukan via combo)', () => {
    expect(computeAllowedLinks('pimpinan')).toContain(DH);
    expect(computeAllowedLinks('admin')).toContain(DH);
  });
});
