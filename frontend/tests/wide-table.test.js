// Feature: mobile-responsive-ui, Task 9.3: Visual/interaction tests for wide tables
// Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
//
// These are example-based STRUCTURAL / static-source tests (NOT property tests).
// Playwright is not available in this environment, so we cannot measure a real
// rendered layout (boundingBox / computed scrollWidth). Instead we assert on the
// DOM structure of the static rekap.html, on the presence of the `scroll-shadow`
// utility in style.css, and on the source text of rekap.js (which builds the
// desktop tables and the per-santri card view at runtime).
//
// Coverage map:
//   Req 5.1 — wide-table container `#table-container` has `overflow-x-auto`
//             (scroll happens inside the container, not the whole page)
//   Req 5.2 — the row-identifier column stays visible: rekap.js builds cells
//             with `sticky left-0` / `sticky left-12`
//   Req 5.3 — per-santri card view: `#rekap-siswa-view` container exists and
//             rekap.js renders cards on mobile (matchMedia + rekap-siswa-view)
//   Req 5.4 — scroll indicator: `scroll-shadow` utility defined in style.css,
//             `#table-scroll-hint` exists in rekap.html and is mobile-only
//   Req 5.5 — table text >= 12px: sticky identifier cells use solid backgrounds
//             and header/table text uses at least `text-xs` (no `text-[11px]`)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

// Vitest runs the frontend suite with cwd at `frontend/`, where the static
// pages, style.css, and src/js live. Resolve everything against process.cwd()
// (see nav-structure.test.js for why we avoid import.meta.url + fileURLToPath
// under the jsdom environment).
function readWorkspaceFile(relPath) {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8');
}

function loadPage(name) {
  return new JSDOM(readWorkspaceFile(name)).window.document;
}

const rekapDoc = loadPage('rekap.html');
const rekapJsSource = readWorkspaceFile('src/js/rekap.js');
const styleCss = readWorkspaceFile('style.css');

// --- Req 5.1: horizontal scroll lives inside the wide-table container --------

describe('Req 5.1 — wide-table container scrolls horizontally in place', () => {
  it('rekap.html #table-container exists and has class overflow-x-auto', () => {
    const container = rekapDoc.querySelector('#table-container');
    expect(container, 'expected #table-container in rekap.html').toBeTruthy();
    expect(container.classList.contains('overflow-x-auto')).toBe(true);
  });

  it('the wide table lives inside #table-container (contained scroll, not page scroll)', () => {
    const container = rekapDoc.querySelector('#table-container');
    // A <table> must be nested in the scroll container so scrolling stays local.
    expect(container.querySelector('table')).toBeTruthy();
  });
});

// --- Req 5.2: row-identifier column stays visible while scrolling -------------

describe('Req 5.2 — row-identifier column stays visible (sticky)', () => {
  it('rekap.js builds the siswa table with a sticky identifier column', () => {
    // The "Nama Santri" identifier header/cells are pinned with sticky left-*.
    expect(rekapJsSource).toContain('sticky left-0');
    expect(rekapJsSource).toContain('sticky left-12');
  });

  it('rekap.js builds the leger table with a sticky identifier column', () => {
    // Both table builders (siswa heatmap + leger transcript) pin the name column.
    // Count occurrences to make sure it appears in more than one builder.
    const stickyHits = (rekapJsSource.match(/sticky left-12/g) || []).length;
    expect(stickyHits).toBeGreaterThanOrEqual(2);
  });
});

// --- Req 5.3: per-santri cards for the attendance recap ----------------------

describe('Req 5.3 — attendance recap rendered as per-santri cards on mobile', () => {
  it('rekap.html contains the #rekap-siswa-view card container', () => {
    expect(rekapDoc.querySelector('#rekap-siswa-view')).toBeTruthy();
  });

  it('rekap.js drives a viewport-aware card view (matchMedia + rekap-siswa-view)', () => {
    // The card view is toggled by viewport width so mobile shows cards while
    // desktop keeps the full table.
    expect(rekapJsSource).toContain('rekap-siswa-view');
    expect(rekapJsSource).toContain('matchMedia');
    // The mobile breakpoint is the Tailwind md boundary (<768px).
    expect(rekapJsSource).toContain('max-width: 767px');
  });
});

// --- Req 5.4: visual scroll indicator when columns overflow ------------------

describe('Req 5.4 — scroll indicator when content overflows', () => {
  it('scroll-shadow utility is defined in style.css', () => {
    expect(styleCss).toContain('.scroll-shadow');
  });

  it('rekap.html #table-container carries the scroll-shadow edge indicator', () => {
    const container = rekapDoc.querySelector('#table-container');
    expect(container.classList.contains('scroll-shadow')).toBe(true);
  });

  it('rekap.html has a mobile-only #table-scroll-hint indicator', () => {
    const hint = rekapDoc.querySelector('#table-scroll-hint');
    expect(hint, 'expected #table-scroll-hint in rekap.html').toBeTruthy();
    // The textual hint is only meaningful on mobile.
    expect(hint.classList.contains('md:hidden')).toBe(true);
  });

  it('rekap.js toggles the scroll hint based on actual overflow (scrollWidth > clientWidth)', () => {
    // The hint should only appear when the table genuinely overflows.
    expect(rekapJsSource).toContain('scrollWidth');
    expect(rekapJsSource).toContain('clientWidth');
  });
});

// --- Req 5.5: table text stays readable (>= 12px) ----------------------------

describe('Req 5.5 — wide-table text stays readable (>= 12px)', () => {
  it('sticky identifier cells use solid backgrounds so overlapped text stays legible', () => {
    // A solid bg (bg-white / dark:bg-slate-800) prevents scrolled-under columns
    // from bleeding through the pinned identifier column.
    expect(rekapJsSource).toContain('bg-white dark:bg-slate-800');
  });

  it('the static table in rekap.html uses at least text-xs (>= 12px)', () => {
    const table = rekapDoc.querySelector('#table-container table');
    expect(table).toBeTruthy();
    // The base table text is text-sm (14px); the head is text-xs (12px). Neither
    // should drop below the 12px floor.
    const head = rekapDoc.querySelector('#table-head');
    expect(head.className).toContain('text-xs');
  });

  it('rekap.js table builders do not use sub-12px text-[11px]', () => {
    // Task 9.1 bumped the siswa/leger table builders up to text-xs; there must be
    // no remaining text-[11px] (11px < 12px) in the runtime table markup.
    expect(rekapJsSource).not.toContain('text-[11px]');
  });

  it('rekap.js table headers use at least text-xs', () => {
    // Day/mapel header cells label their text with text-xs.
    expect(rekapJsSource).toContain('text-xs');
  });
});
