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

  it('mufatish has all pages except /settings.html and /absensi-manual.html', () => {
    expect(MENU_ACCESS.mufatish).toEqual(ALL_PAGES.filter(p => p !== '/settings.html' && p !== '/absensi-manual.html'));
  });

  it('mustahiq has grades & attendance set', () => {
    expect(MENU_ACCESS.mustahiq).toEqual(
      ['/index.html', '/penilaian.html', '/absensi.html', '/rapot.html', '/rekap.html', '/catatan.html']
    );
  });

  it('muroqib has attendance only', () => {
    expect(MENU_ACCESS.muroqib).toEqual(['/index.html', '/santri.html', '/kelas.html', '/absensi-manual.html', '/rekap.html', '/catatan.html']);
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
