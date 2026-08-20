// Feature: mobile-responsive-ui, Task 6.3: Structural tests for priority-page navigation
// Validates: Requirements 1.1, 1.2, 1.3, 1.4, 11.1, 11.2
//
// These are example-based STRUCTURAL tests (NOT property tests). They read the
// static page HTML from disk, parse each page with jsdom, and assert that the
// canonical navigation scaffolding is present on every covered page:
//   - exactly one `aside#app-sidebar` drawer (transform-based on mobile,
//     fixed on desktop)
//   - the mobile close button `#btn-close-sidebar`
//   - the mobile `#sidebar-backdrop`
//   - the top-bar hamburger `#btn-open-sidebar`
//   - the fixed Bottom_Nav (`nav.md:hidden.fixed.bottom-0`) with its FAB
//     `#btn-mobile-search`
//
// It then asserts that the Bottom_Nav of each PRIORITY page is normalized-identical
// to index.html (the canonical reference). A raw outerHTML/innerHTML match is too
// brittle here: index.html bakes the active state into its "Beranda" link and
// rapot.html adds `print:hidden` to the nav container. So the "normalized nav
// block" is defined as the stable nav signature — the ordered list of nav anchor
// hrefs + their `data-nav` marker + icon + label, plus the FAB (id, aria-label,
// icon). That signature must match index.html exactly for the five priority pages
// (Requirement 11.1), which is the robust identity guaranteed by the design.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

// Resolve page paths against the process cwd. Vitest runs the frontend test
// suite with cwd at `frontend/`, where the static pages live. We deliberately
// avoid import.meta.url + fileURLToPath here: under the jsdom test environment
// the global `URL` is jsdom's implementation, which node's fileURLToPath rejects
// ("The URL must be of scheme file").
function pagePath(name) {
  return resolve(process.cwd(), name);
}

function loadPage(name) {
  const html = readFileSync(pagePath(name), 'utf8');
  return new JSDOM(html).window.document;
}

// The five most-accessed pages (Requirement 11) — Bottom_Nav must match index.html.
const PRIORITY_PAGES = [
  'index.html',
  'absensi.html',
  'rapot.html',
  'rekap.html',
  'profil-santri.html',
];

// The remaining covered pages. login.html and change-password.html are excluded
// per Requirements 1.1-1.3.
const OTHER_COVERED_PAGES = [
  'santri.html',
  'perpindahan.html',
  'kelas.html',
  'penilaian.html',
  'pengajar.html',
  'dewan-harian.html',
  'arsip.html',
  'alumni.html',
  'settings.html',
];

const ALL_COVERED_PAGES = [...PRIORITY_PAGES, ...OTHER_COVERED_PAGES];

// --- helpers -------------------------------------------------------------

// Find the Bottom_Nav element: a <nav> that is mobile-only, fixed, and pinned to
// the bottom. Class-based lookup (rather than an escaped selector) is robust to
// class ordering and to extra classes like `print:hidden`.
function findBottomNav(doc) {
  return [...doc.querySelectorAll('nav')].find(
    (nav) =>
      nav.classList.contains('md:hidden') &&
      nav.classList.contains('fixed') &&
      nav.classList.contains('bottom-0')
  );
}

// Build a normalized signature of a Bottom_Nav's contents. This captures the
// meaningful, stable structure shared across all pages while ignoring the
// per-page active-state class on a link and container-level classes.
function bottomNavSignature(nav) {
  const anchors = [...nav.querySelectorAll('a[data-nav]')].map((a) => {
    const icon = a.querySelector('i[data-lucide]');
    const label = a.querySelector('span');
    return {
      href: a.getAttribute('href'),
      dataNav: a.hasAttribute('data-nav'),
      icon: icon ? icon.getAttribute('data-lucide') : null,
      label: label ? label.textContent.replace(/\s+/g, ' ').trim() : null,
    };
  });

  const fabBtn = nav.querySelector('#btn-mobile-search');
  const fabIcon = fabBtn ? fabBtn.querySelector('i[data-lucide]') : null;
  const fab = fabBtn
    ? {
        id: fabBtn.id,
        ariaLabel: fabBtn.getAttribute('aria-label'),
        icon: fabIcon ? fabIcon.getAttribute('data-lucide') : null,
      }
    : null;

  return { anchors, fab };
}

// --- structural presence across every covered page ----------------------

describe('canonical navigation structure on covered pages (Req 1.1-1.4, 11.1-11.2)', () => {
  it.each(ALL_COVERED_PAGES)('%s has exactly one drawer sidebar aside#app-sidebar', (page) => {
    const doc = loadPage(page);
    const sidebars = doc.querySelectorAll('aside#app-sidebar');
    expect(sidebars.length).toBe(1);

    // Req 1.1 / 1.6 / 1.5: drawer transform on mobile, fixed on desktop.
    const cl = sidebars[0].classList;
    expect(cl.contains('-translate-x-full')).toBe(true);
    expect(cl.contains('md:translate-x-0')).toBe(true);
  });

  it.each(ALL_COVERED_PAGES)('%s has the mobile close button #btn-close-sidebar', (page) => {
    const doc = loadPage(page);
    expect(doc.querySelectorAll('#btn-close-sidebar').length).toBe(1);
  });

  it.each(ALL_COVERED_PAGES)('%s has the sidebar backdrop #sidebar-backdrop', (page) => {
    const doc = loadPage(page);
    expect(doc.querySelectorAll('#sidebar-backdrop').length).toBe(1);
  });

  it.each(ALL_COVERED_PAGES)('%s has the top-bar hamburger #btn-open-sidebar', (page) => {
    const doc = loadPage(page);
    expect(doc.querySelectorAll('#btn-open-sidebar').length).toBe(1);
  });

  it.each(ALL_COVERED_PAGES)('%s has the fixed Bottom_Nav with FAB #btn-mobile-search', (page) => {
    const doc = loadPage(page);

    const nav = findBottomNav(doc);
    expect(nav, `expected nav.md:hidden.fixed.bottom-0 on ${page}`).toBeTruthy();

    // Req 3.2: the Bottom_Nav carries the central FAB.
    const fab = nav.querySelector('#btn-mobile-search');
    expect(fab, `expected FAB #btn-mobile-search inside Bottom_Nav on ${page}`).toBeTruthy();
  });
});

// --- normalized Bottom_Nav identity for the priority pages ---------------

describe('Bottom_Nav is normalized-identical to index.html on priority pages (Req 1.4, 11.1)', () => {
  // Canonical reference: index.html.
  const referenceSignature = bottomNavSignature(findBottomNav(loadPage('index.html')));

  // Sanity check the reference itself so a broken index.html fails loudly.
  it('index.html reference exposes the expected canonical nav anchors + FAB', () => {
    expect(referenceSignature.anchors.map((a) => a.href)).toEqual([
      '/index.html',
      '/santri.html',
      '/penilaian.html',
      '/absensi.html',
    ]);
    expect(referenceSignature.anchors.every((a) => a.dataNav)).toBe(true);
    expect(referenceSignature.fab).toEqual({
      id: 'btn-mobile-search',
      ariaLabel: 'Cari',
      icon: 'search',
    });
  });

  it.each(PRIORITY_PAGES)('%s Bottom_Nav signature matches index.html exactly', (page) => {
    const nav = findBottomNav(loadPage(page));
    expect(nav, `expected a Bottom_Nav on ${page}`).toBeTruthy();
    expect(bottomNavSignature(nav)).toEqual(referenceSignature);
  });
});
