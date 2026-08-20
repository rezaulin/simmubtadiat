import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolveActiveNav, markActiveNav } from '../src/js/xss.js';

// Feature: mobile-responsive-ui, Property 3: Penentuan tautan aktif benar dan tunggal.
// Untuk setiap pathname halaman, resolveActiveNav(pathname, items) harus menandai
// tepat satu tautan sebagai aktif jika pathname cocok dengan href salah satu item,
// dan tidak menandai satu pun bila tidak ada yang cocok; tautan lain selain yang
// cocok tidak boleh ditandai aktif.
// Validates: Requirements 3.3

// The full universe of nav hrefs used across the canonical Bottom_Nav / sidebar.
const ALL_HREFS = [
  '/index.html', '/santri.html', '/perpindahan.html', '/kelas.html',
  '/penilaian.html', '/absensi.html', '/rapot.html', '/pengajar.html',
  '/dewan-harian.html', '/arsip.html', '/alumni.html',
  '/rekap.html', '/settings.html'
];

// Paths that are guaranteed NOT to be one of the nav hrefs (mismatch cases).
const NON_MATCH_PATHS = [
  '/login.html', '/change-password.html', '/', '/unknown.html',
  '/index', 'index.html', '/INDEX.HTML', '/rapot.html/', '/absensi'
];

// Absolute-only mismatch paths for jsdom: pushState resolves relative URLs
// against the current location, so only leading-slash paths are guaranteed to
// remain non-matching pathnames in the DOM.
const ABS_NON_MATCH_PATHS = [
  '/login.html', '/change-password.html', '/', '/unknown.html',
  '/index', '/INDEX.HTML', '/rapot.html/', '/absensi'
];

describe('Property 3: resolveActiveNav marks exactly one / zero active links', () => {
  it('returns the single matching item when pathname matches a nav href', () => {
    fc.assert(
      fc.property(
        // A page's nav is a non-empty subset of the known hrefs, with distinct
        // hrefs (as in the canonical markup), plus an index into it.
        fc
          .uniqueArray(fc.constantFrom(...ALL_HREFS), { minLength: 1, maxLength: ALL_HREFS.length })
          .chain((hrefs) =>
            fc.record({
              hrefs: fc.constant(hrefs),
              index: fc.integer({ min: 0, max: hrefs.length - 1 }),
            })
          ),
        ({ hrefs, index }) => {
          const items = hrefs.map((href, i) => ({ href, label: `item-${i}` }));
          const pathname = hrefs[index];

          const active = resolveActiveNav(pathname, items);

          // Exactly-one guarantee: a match is returned, its href equals the
          // pathname, and precisely one item in the set carries that href.
          expect(active).not.toBeNull();
          expect(active.href).toBe(pathname);

          const matchCount = items.filter((it) => it.href === pathname).length;
          expect(matchCount).toBe(1);

          // No other item is considered active.
          const activeItems = items.filter((it) => it === active);
          expect(activeItems).toHaveLength(1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns null (zero active) when pathname does not match any nav href', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...ALL_HREFS), { minLength: 0, maxLength: ALL_HREFS.length }),
        fc.constantFrom(...NON_MATCH_PATHS),
        (hrefs, pathname) => {
          const items = hrefs.map((href, i) => ({ href, label: `item-${i}` }));

          const active = resolveActiveNav(pathname, items);

          expect(active).toBeNull();
          // No item's href equals the mismatching pathname.
          expect(items.some((it) => it.href === pathname)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  // DOM-level guarantee for markActiveNav(): exactly one a[data-nav] carries the
  // active classes when the current pathname matches, zero otherwise.
  it('markActiveNav applies active classes to exactly one link when matching (jsdom)', () => {
    fc.assert(
      fc.property(
        fc
          .uniqueArray(fc.constantFrom(...ALL_HREFS), { minLength: 1, maxLength: ALL_HREFS.length })
          .chain((hrefs) =>
            fc.record({
              hrefs: fc.constant(hrefs),
              index: fc.integer({ min: 0, max: hrefs.length - 1 }),
            })
          ),
        ({ hrefs, index }) => {
          document.body.innerHTML = '';
          const nav = document.createElement('nav');
          hrefs.forEach((href) => {
            const a = document.createElement('a');
            a.setAttribute('href', href);
            a.setAttribute('data-nav', '');
            nav.appendChild(a);
          });
          document.body.appendChild(nav);

          const target = hrefs[index];
          window.history.pushState({}, '', target);

          const active = markActiveNav();

          expect(active).not.toBeNull();
          expect(active.href).toBe(target);

          const links = Array.from(document.querySelectorAll('a[data-nav]'));
          const activeLinks = links.filter((l) => l.classList.contains('text-indigo-600'));
          expect(activeLinks).toHaveLength(1);
          expect(activeLinks[0].getAttribute('href')).toBe(target);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('markActiveNav applies active classes to zero links when not matching (jsdom)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...ALL_HREFS), { minLength: 1, maxLength: ALL_HREFS.length }),
        fc.constantFrom(...ABS_NON_MATCH_PATHS),
        (hrefs, pathname) => {
          document.body.innerHTML = '';
          const nav = document.createElement('nav');
          hrefs.forEach((href) => {
            const a = document.createElement('a');
            a.setAttribute('href', href);
            a.setAttribute('data-nav', '');
            nav.appendChild(a);
          });
          document.body.appendChild(nav);

          window.history.pushState({}, '', pathname);

          const active = markActiveNav();

          expect(active).toBeNull();
          const links = Array.from(document.querySelectorAll('a[data-nav]'));
          const activeLinks = links.filter((l) => l.classList.contains('text-indigo-600'));
          expect(activeLinks).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
