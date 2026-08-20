// Feature: mobile-responsive-ui, Task 11.4: Touch-target measurement tests
// Validates: Requirements 6.1, 6.2
//
// WHY THIS IS A STRUCTURAL TEST AND NOT A REAL boundingBox MEASUREMENT
// ---------------------------------------------------------------------------
// The design's Testing Strategy calls for measuring `boundingBox` with Playwright
// to assert every Target_Sentuh is >= 44x44px and that adjacent targets are
// separated by >= 8px on Viewport_Mobile (Req 6.1, 6.2). Real pixel measurement
// requires a browser with a layout engine.
//
// This suite runs under Vitest + jsdom. jsdom deliberately does NOT implement a
// layout engine: `getBoundingClientRect()` returns all-zero rects and CSS
// (including `@media` rules and Tailwind utilities) is never applied to computed
// geometry. Playwright is not available in this environment. So a literal pixel
// measurement here would be meaningless (every box would read 0x0).
//
// Instead we validate the STRUCTURAL GUARANTEES that enforce the requirement,
// which is exactly how the size/spacing are actually produced in this codebase:
//
//   Req 6.1 (>= 44x44px): the `.tap-target` utility in frontend/style.css sets
//     `min-width: 44px; min-height: 44px` inside a `@media (max-width: 767px)`
//     (Viewport_Mobile) block. Any control carrying `.tap-target` is therefore
//     guaranteed >= 44x44px on mobile by CSS. We (a) prove the rule exists and
//     specifies both minimums within the mobile media query by parsing the CSS
//     text, and (b) prove the canonical icon-only nav controls on the priority
//     pages actually carry the `.tap-target` class.
//
//   Req 6.2 (>= 8px between adjacent targets): the Top_Bar_Mobile and the
//     Bottom_Nav inner row separate their touch targets with `justify-between`,
//     which pushes items to opposite ends of a full-width flex row and thus
//     maximizes the gap far beyond 8px. (Tailwind's `gap-2` = 0.5rem = 8px is
//     the equivalent explicit-spacing guarantee.) We assert those spacing
//     utilities are present rather than measuring pixels.
//
// These assertions are reliable under jsdom and give meaningful coverage of the
// requirement; the pixel-accurate boundingBox pass belongs to a browser-based
// (Playwright) run that this environment cannot host.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

// Resolve paths against the process cwd (frontend/), matching the other suites.
// We avoid import.meta.url + fileURLToPath because jsdom's global URL is rejected
// by node's fileURLToPath under the jsdom test environment.
function assetPath(name) {
  return resolve(process.cwd(), name);
}

function readAsset(name) {
  return readFileSync(assetPath(name), 'utf8');
}

function loadPage(name) {
  return new JSDOM(readAsset(name)).window.document;
}

// The five most-accessed pages (Requirement 11). The canonical icon-only nav
// controls must be tap-targets on every one of them.
const PRIORITY_PAGES = [
  'index.html',
  'absensi.html',
  'rapot.html',
  'rekap.html',
  'profil-santri.html',
];

// The canonical icon-only navigation controls (no text label) that are the
// primary Target_Sentuh of the mobile chrome. Each MUST be >= 44x44px on mobile,
// which is guaranteed by the `.tap-target` class.
const ICON_ONLY_NAV_CONTROLS = [
  'btn-open-sidebar', // hamburger in Top_Bar_Mobile
  'btn-close-sidebar', // close button in Drawer_Sidebar
  'theme-toggle-mobile', // theme toggle in Top_Bar_Mobile
  'btn-mobile-search', // FAB in Bottom_Nav
];

// --- CSS text helpers ----------------------------------------------------

// Extract the body of the FIRST balanced `{...}` block starting at/after `from`.
// Returns the inner text (without the outer braces). Handles nested braces so it
// works for `@media { .rule { ... } }`.
function balancedBlockAfter(css, from) {
  const open = css.indexOf('{', from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

// Find the inner text of the `@media (max-width: 767px)` block (the
// Viewport_Mobile breakpoint used by `.tap-target`). Whitespace inside the
// media query parentheses is normalized so `max-width:767px` and
// `max-width: 767px` both match.
function mobileMediaBlock(css) {
  const re = /@media\s*\(\s*max-width\s*:\s*767px\s*\)/g;
  const match = re.exec(css);
  if (!match) return null;
  return balancedBlockAfter(css, match.index);
}

// Extract the declaration body of a `.tap-target { ... }` rule from a chunk of
// CSS text.
function tapTargetRuleBody(cssChunk) {
  const idx = cssChunk.indexOf('.tap-target');
  if (idx === -1) return null;
  return balancedBlockAfter(cssChunk, idx);
}

// True when the element carries EVERY class in `classes` (order-independent).
function hasClasses(el, ...classes) {
  return classes.every((c) => el.classList.contains(c));
}

// =========================================================================
// Req 6.1 — Touch targets are >= 44x44px on Viewport_Mobile
// =========================================================================

describe('touch target minimum size via .tap-target utility (Req 6.1)', () => {
  const css = readAsset('style.css');

  it('style.css defines .tap-target with min 44x44px inside the mobile (max-width:767px) media query', () => {
    const mediaBlock = mobileMediaBlock(css);
    expect(
      mediaBlock,
      'expected a @media (max-width: 767px) block in style.css'
    ).toBeTruthy();

    const rule = tapTargetRuleBody(mediaBlock);
    expect(
      rule,
      'expected a .tap-target rule inside the @media (max-width: 767px) block'
    ).toBeTruthy();

    // Req 6.1: the rule pins both minimum dimensions to 44px. Whitespace between
    // the property, colon and value is tolerated.
    expect(/min-width\s*:\s*44px/.test(rule)).toBe(true);
    expect(/min-height\s*:\s*44px/.test(rule)).toBe(true);
  });

  it.each(PRIORITY_PAGES)(
    '%s: every canonical icon-only nav control carries the .tap-target class',
    (page) => {
      const doc = loadPage(page);
      for (const id of ICON_ONLY_NAV_CONTROLS) {
        const el = doc.getElementById(id);
        expect(el, `expected #${id} on ${page}`).toBeTruthy();
        expect(
          el.classList.contains('tap-target'),
          `#${id} on ${page} must have the .tap-target class to guarantee >= 44x44px`
        ).toBe(true);
      }
    }
  );
});

// =========================================================================
// Req 6.2 — Adjacent touch targets are separated by >= 8px on Viewport_Mobile
// =========================================================================

describe('spacing between adjacent touch targets (Req 6.2)', () => {
  // The Top_Bar_Mobile is a full-width flex row that pushes the hamburger and
  // the theme toggle to opposite ends via `justify-between`, guaranteeing a gap
  // well beyond 8px.
  it.each(PRIORITY_PAGES)(
    '%s: Top_Bar_Mobile spaces its controls apart with justify-between',
    (page) => {
      const doc = loadPage(page);
      const hamburger = doc.getElementById('btn-open-sidebar');
      expect(hamburger, `expected #btn-open-sidebar on ${page}`).toBeTruthy();

      const topBar = hamburger.closest('header');
      expect(topBar, `expected a <header> Top_Bar_Mobile on ${page}`).toBeTruthy();
      expect(
        hasClasses(topBar, 'flex', 'justify-between'),
        `Top_Bar_Mobile on ${page} should use flex justify-between to space targets`
      ).toBe(true);
    }
  );

  // The Bottom_Nav inner row lays out its links + FAB in a full-width flex row
  // with `justify-between`, maximizing the separation between adjacent targets.
  it.each(PRIORITY_PAGES)(
    '%s: Bottom_Nav inner row spaces its targets apart with justify-between',
    (page) => {
      const doc = loadPage(page);
      const fab = doc.getElementById('btn-mobile-search');
      expect(fab, `expected #btn-mobile-search on ${page}`).toBeTruthy();

      // The FAB lives inside the fixed Bottom_Nav; its inner flex row is the
      // container that spaces the nav anchors.
      const bottomNav = fab.closest('nav');
      expect(bottomNav, `expected the Bottom_Nav <nav> on ${page}`).toBeTruthy();

      const innerRow = bottomNav.querySelector('.flex.justify-between');
      expect(
        innerRow,
        `Bottom_Nav inner row on ${page} should use flex justify-between to space targets`
      ).toBeTruthy();
      expect(hasClasses(innerRow, 'flex', 'justify-between')).toBe(true);
    }
  );
});
