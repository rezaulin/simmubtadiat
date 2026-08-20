// Feature: mobile-responsive-ui, Task 10.4: Visual/interaction tests for forms, modal, and hero
// Validates: Requirements 7.1, 7.2, 8.1, 8.2, 8.4, 9.1, 9.2, 9.3, 11.3
//
// These are example-based STRUCTURAL / INTERACTION tests (NOT property tests).
// Playwright and real layout measurement (boundingBox) are not available in this
// environment, so instead of measuring pixels we assert on the Tailwind classes
// and DOM structure/behavior that GUARANTEE the responsive layout:
//
//   - single-column-on-mobile forms/filters via `flex flex-col sm:flex-row`
//     with `w-full sm:w-*` controls (Req 7.1, 7.2)
//   - semantic date inputs (`type="date"`) (Req 7.4)
//   - scrollable tab/filter rows via `overflow-x-auto` (Req 11.3)
//   - the Header_Hero stacking (`flex flex-col md:flex-row`), responsive title
//     text scale (`text-3xl md:text-4xl` / `md:text-3xl`) and `break-words`
//     (Req 9.1, 9.2, 9.3)
//   - the responsive modal box: `w-full max-w-2xl`, outer padding
//     `p-4 sm:p-6 md:p-12`, height `h-[80vh] md:h-[600px]`, scrollable results
//     area `overflow-y-auto`, and a `tap-target` close button with an aria-label
//     (Req 8.1, 8.2, 8.3)
//   - modal body scroll-lock behavior asserted on the main.js source: the
//     injected canonical modal template carries the responsive classes, and
//     openSearchModal/closeSearchModal add/remove `overflow-hidden` on the body
//     (Req 8.4)
//
// Assertions are deliberately robust: class-contains lookups (order-independent,
// tolerant of extra classes) for the DOM, and scoped substring/regex checks for
// the main.js source.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

// Resolve page paths against the process cwd (frontend/), matching the other
// suites. We avoid import.meta.url + fileURLToPath because jsdom's global URL is
// rejected by node's fileURLToPath.
function pagePath(name) {
  return resolve(process.cwd(), name);
}

function readPage(name) {
  return readFileSync(pagePath(name), 'utf8');
}

function loadPage(name) {
  return new JSDOM(readPage(name)).window.document;
}

// --- helpers -------------------------------------------------------------

// True when the element carries EVERY class in `classes` (order-independent,
// tolerant of additional classes). Tailwind arbitrary-value classes like
// `h-[80vh]` and `md:h-[600px]` are stored verbatim in classList, so this works
// for them too.
function hasClasses(el, ...classes) {
  return classes.every((c) => el.classList.contains(c));
}

// True when the element has at least one class matching the given prefix regex,
// e.g. hasClassMatching(el, /^sm:w-/) checks for any `sm:w-*` width class.
function hasClassMatching(el, re) {
  return [...el.classList].some((c) => re.test(c));
}

// A form control is "full-width on mobile, fixed on sm+" when it has `w-full`
// and some `sm:w-*` class.
function isResponsiveWidthControl(el) {
  return el.classList.contains('w-full') && hasClassMatching(el, /^sm:w-/);
}

// =========================================================================
// Req 7.1 / 7.2 / 7.4 — Responsive forms & filters
// =========================================================================

describe('responsive form/filter layout (Req 7.1, 7.2, 7.4)', () => {
  it('rekap.html filter sections use flex-col sm:flex-row with w-full sm:w-* controls', () => {
    const doc = loadPage('rekap.html');

    const sectionIds = [
      'filter-section-siswa',
      'filter-section-pengajar',
      'filter-section-leger',
    ];

    for (const id of sectionIds) {
      const section = doc.getElementById(id);
      expect(section, `expected #${id} in rekap.html`).toBeTruthy();

      // Req 7.1: single column on mobile, row from `sm` up.
      expect(
        hasClasses(section, 'flex-col', 'sm:flex-row'),
        `#${id} should stack vertically on mobile (flex-col sm:flex-row)`
      ).toBe(true);

      // Req 7.2: every select/input control is full width on mobile and fixed
      // width from `sm` up.
      const controls = [...section.querySelectorAll('select, input')];
      expect(controls.length, `#${id} should contain form controls`).toBeGreaterThan(0);
      for (const control of controls) {
        expect(
          isResponsiveWidthControl(control),
          `control ${control.id || control.tagName} in #${id} should be w-full sm:w-*`
        ).toBe(true);
      }
    }
  });

  it('rekap.html date inputs use semantic type="date" (Req 7.4)', () => {
    const doc = loadPage('rekap.html');
    const dateInputs = [
      'filter-start-date-siswa',
      'filter-end-date-siswa',
      'filter-start-date',
      'filter-end-date',
    ];
    for (const id of dateInputs) {
      const input = doc.getElementById(id);
      expect(input, `expected #${id} in rekap.html`).toBeTruthy();
      expect(input.getAttribute('type')).toBe('date');
    }
  });

  it('absensi.html filter row uses flex flex-col sm:flex-row with w-full controls', () => {
    const doc = loadPage('absensi.html');
    const filter = doc.getElementById('filter-section');
    expect(filter, 'expected #filter-section in absensi.html').toBeTruthy();

    // Req 7.1
    expect(hasClasses(filter, 'flex', 'flex-col', 'sm:flex-row')).toBe(true);

    // Req 7.2: controls are full-width on mobile.
    const controls = [...filter.querySelectorAll('select, input')];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(
        control.classList.contains('w-full'),
        `control ${control.id || control.tagName} in #filter-section should be w-full`
      ).toBe(true);
    }
  });

  it('rapot.html filter selects use w-full sm:w-* (Req 7.2)', () => {
    const doc = loadPage('rapot.html');
    const selectIds = [
      'filter-tahun-ajaran',
      'filter-tingkatan',
      'filter-kelas',
      'filter-bagian',
      'filter-semester',
    ];
    for (const id of selectIds) {
      const select = doc.getElementById(id);
      expect(select, `expected #${id} in rapot.html`).toBeTruthy();
      expect(
        isResponsiveWidthControl(select),
        `#${id} should be w-full sm:w-*`
      ).toBe(true);
    }
  });
});

// =========================================================================
// Req 11.3 — Scrollable tab / filter rows on priority pages
// =========================================================================

describe('scrollable tab/filter rows (Req 11.3)', () => {
  it('rekap.html tab bar container is horizontally scrollable (overflow-x-auto)', () => {
    const doc = loadPage('rekap.html');
    // The tab bar holds the three tab buttons.
    const tabSiswa = doc.getElementById('tab-siswa');
    expect(tabSiswa, 'expected #tab-siswa in rekap.html').toBeTruthy();

    const tabContainer = tabSiswa.parentElement;
    expect(
      tabContainer.classList.contains('overflow-x-auto'),
      'rekap.html tab bar container should have overflow-x-auto'
    ).toBe(true);
    // Sanity: it actually contains all three tabs.
    expect(tabContainer.querySelector('#tab-pengajar')).toBeTruthy();
    expect(tabContainer.querySelector('#tab-leger')).toBeTruthy();
  });

  it('profil-santri.html tab nav container is horizontally scrollable (overflow-x-auto)', () => {
    const doc = loadPage('profil-santri.html');
    const tabBiodata = doc.getElementById('tab-biodata');
    expect(tabBiodata, 'expected #tab-biodata in profil-santri.html').toBeTruthy();

    // The tab <nav> sits inside the scrollable wrapper.
    const nav = tabBiodata.closest('nav');
    expect(nav, 'expected a <nav> wrapping the tabs').toBeTruthy();
    const scrollWrapper = nav.parentElement;
    expect(
      scrollWrapper.classList.contains('overflow-x-auto'),
      'profil-santri.html tab nav container should have overflow-x-auto'
    ).toBe(true);
  });
});

// =========================================================================
// Req 9.1 / 9.2 / 9.3 — Responsive Header_Hero
// =========================================================================

describe('responsive Header_Hero (Req 9.1, 9.2, 9.3)', () => {
  it('index.html hero scales the greeting text and exposes avatar + info chips', () => {
    const doc = loadPage('index.html');

    // Req 9.2: smaller title on mobile, larger from `md` up.
    const greeting = doc.getElementById('user-greeting');
    expect(greeting, 'expected #user-greeting in index.html').toBeTruthy();
    expect(hasClasses(greeting, 'text-2xl', 'md:text-4xl')).toBe(true);
    // Req 9.3: text kept within bounds.
    expect(greeting.classList.contains('break-words')).toBe(true);

    // Sapaan islami statis di hero.
    const salam = doc.getElementById('greeting-text');
    expect(salam, 'expected #greeting-text').toBeTruthy();
    expect(salam.textContent).toMatch(/Assalamu/i);

    // Avatar inisial (tanpa foto) + 3 chip info: tanggal, jam hidup, Hijriyah.
    expect(doc.getElementById('user-avatar'), 'expected #user-avatar').toBeTruthy();
    expect(doc.getElementById('hero-date'), 'expected #hero-date').toBeTruthy();
    expect(doc.getElementById('hero-time'), 'expected #hero-time').toBeTruthy();
    expect(doc.getElementById('hero-hijri'), 'expected #hero-hijri').toBeTruthy();
  });

  it.each(['rekap.html', 'absensi.html'])(
    '%s content header uses flex flex-col md:flex-row with responsive title + break-words',
    (page) => {
      const doc = loadPage(page);

      // The content header holds the page title <h2> with break-words.
      const title = [...doc.querySelectorAll('h2.break-words')].find((h) =>
        hasClassMatching(h, /^md:text-/)
      );
      expect(title, `expected a responsive break-words <h2> title on ${page}`).toBeTruthy();

      // Req 9.2: title scales up at md (e.g. md:text-3xl).
      expect(hasClassMatching(title, /^md:text-3xl$/)).toBe(true);
      // Req 9.3: break-words keeps the text within bounds.
      expect(title.classList.contains('break-words')).toBe(true);

      // Req 9.1: the enclosing header row stacks on mobile.
      const headerRow = title.closest('.flex.flex-col');
      expect(headerRow, `expected a flex flex-col header row on ${page}`).toBeTruthy();
      expect(hasClasses(headerRow, 'flex', 'flex-col', 'md:flex-row')).toBe(true);
    }
  );
});

// =========================================================================
// Req 8.1 / 8.2 / 8.3 — Responsive modal (index.html markup)
// =========================================================================

describe('responsive search modal markup (Req 8.1, 8.2, 8.3)', () => {
  it('index.html #search-modal content fits the viewport and scrolls its results', () => {
    const doc = loadPage('index.html');

    const modal = doc.getElementById('search-modal');
    expect(modal, 'expected #search-modal in index.html').toBeTruthy();

    // Req 8.1: outer container padding shrinks on mobile so the box stays inside
    // the viewport.
    expect(hasClasses(modal, 'p-4', 'sm:p-6', 'md:p-12')).toBe(true);

    // Req 8.1: the content box is full width but capped, with a viewport-relative
    // height on mobile and a fixed height from md up.
    const content = doc.getElementById('search-content');
    expect(content, 'expected #search-content').toBeTruthy();
    expect(hasClasses(content, 'w-full', 'max-w-2xl')).toBe(true);
    expect(hasClasses(content, 'h-[80vh]', 'md:h-[600px]')).toBe(true);

    // Req 8.2: the results area scrolls vertically when content overflows.
    const results = doc.getElementById('search-results');
    expect(results, 'expected #search-results').toBeTruthy();
    expect(results.classList.contains('overflow-y-auto')).toBe(true);
  });

  it('index.html #search-close is a tap-target with a non-empty aria-label (Req 8.3 -> Req 6)', () => {
    const doc = loadPage('index.html');
    const close = doc.getElementById('search-close');
    expect(close, 'expected #search-close in index.html').toBeTruthy();
    expect(close.classList.contains('tap-target')).toBe(true);
    expect((close.getAttribute('aria-label') || '').trim().length).toBeGreaterThan(0);
  });
});

// =========================================================================
// Req 8.4 — Modal body scroll-lock (asserted on main.js source)
// =========================================================================

describe('modal scroll-lock and canonical template in xss.js (Req 8.1, 8.2, 8.4)', () => {
  // Global search (modal template + open/close + scroll-lock) lives in xss.js,
  // which is loaded on every page so the FAB works everywhere (not just dashboard).
  const source = readFileSync(
    resolve(process.cwd(), 'src/js/xss.js'),
    'utf8'
  );

  // Extract a function body by name so the add/remove assertions are scoped to
  // the correct function rather than matching anywhere in the file.
  function functionBody(name) {
    const start = source.indexOf(`function ${name}(`);
    expect(start, `expected function ${name} in main.js`).toBeGreaterThan(-1);
    // Walk braces from the first `{` after the signature to find the matching close.
    const open = source.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(open, i + 1);
      }
    }
    throw new Error(`could not find end of function ${name}`);
  }

  it('openSearchModal locks body scroll by adding overflow-hidden (Req 8.4)', () => {
    const body = functionBody('openSearchModal');
    expect(/document\.body\.classList\.add\(\s*['"]overflow-hidden['"]/.test(body)).toBe(true);
  });

  it('closeSearchModal releases body scroll by removing overflow-hidden (Req 8.4)', () => {
    const body = functionBody('closeSearchModal');
    expect(/document\.body\.classList\.remove\(\s*['"]overflow-hidden['"]/.test(body)).toBe(true);
  });

  it('injected modal template carries the canonical responsive classes (Req 8.1, 8.2, 8.3)', () => {
    // The template string is inserted when a page has no #search-modal of its own.
    expect(source).toContain('w-full max-w-2xl');
    expect(source).toContain('p-4 sm:p-6 md:p-12');
    expect(source).toContain('h-[80vh] md:h-[600px]');
    expect(source).toContain('overflow-y-auto');
    expect(source).toContain('tap-target');
  });
});
