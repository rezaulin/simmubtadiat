// Feature: mobile-responsive-ui, Task 11.3: Static markup scan (lint-style) tests
// Validates: Requirements 6.3, 10.1, 10.2, 10.3, 12.1, 12.2, 12.3
//
// These are example-based, lint-style STRUCTURAL scans (NOT property tests). They
// read each static page HTML from disk, parse it with jsdom, and assert three
// markup invariants across all covered pages:
//
//   1. Meta viewport (Req 12.1-12.3): every page's <meta name="viewport"> content
//      enables zoom -> it contains `initial-scale=1.0`, and does NOT contain
//      `user-scalable=no` nor `maximum-scale` (which would disable/limit zoom).
//
//   2. Responsive breakpoint consistency (Req 10.1-10.3): every responsive
//      breakpoint variant prefix used in a class token is one of the built-in
//      Tailwind breakpoints (sm|md|lg|xl|2xl). No arbitrary `min-[...]`/`max-[...]`
//      width variants (custom breakpoints) are used for layout, and `md:` (the
//      single mobile/desktop boundary) is present on every navigation page.
//
//   3. Icon-only accessibility (Req 6.3): every <button>/<a> that has no visible
//      text (only an icon such as <i data-lucide>, a Font Awesome <i class="fa*">,
//      an <svg>, an <img>, or whitespace) must carry a non-empty `aria-label`.
//
// Resolve page paths against process.cwd(). Vitest runs the frontend suite with
// cwd at `frontend/`, where the static pages live. We deliberately avoid
// import.meta.url + fileURLToPath here: under the jsdom test environment the
// global `URL` is jsdom's implementation, which node's fileURLToPath rejects.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

function pagePath(name) {
  return resolve(process.cwd(), name);
}

function loadPage(name) {
  const html = readFileSync(pagePath(name), 'utf8');
  return { html, doc: new JSDOM(html).window.document };
}

// Navigation pages carry the canonical mobile navigation scaffolding and thus
// must use the `md:` mobile/desktop boundary. login.html / change-password.html
// are excluded from the nav scaffolding (Requirements 1.1-1.3) but are still
// scanned for viewport, breakpoint validity, and icon-only aria-labels.
const NAV_PAGES = [
  'index.html',
  'santri.html',
  'perpindahan.html',
  'kelas.html',
  'penilaian.html',
  'absensi.html',
  'rapot.html',
  'pengajar.html',
  'dewan-harian.html',
  'arsip.html',
  'alumni.html',
  'rekap.html',
  'settings.html',
  'profil-santri.html',
];

const AUTH_PAGES = ['login.html', 'change-password.html'];

const ALL_PAGES = [...NAV_PAGES, ...AUTH_PAGES];

// --- helpers -------------------------------------------------------------

// Split a Tailwind class token into its variant segments + final utility,
// splitting only on top-level `:` (colons that are NOT inside `[...]` arbitrary
// values / selectors, e.g. `before:content-['']` or `md:[&:hover]:flex`).
// Returns { variants: string[], utility: string }.
function splitToken(token) {
  const parts = [];
  let buf = '';
  let depth = 0;
  for (const ch of token) {
    if (ch === '[') depth++;
    else if (ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ':' && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  parts.push(buf);
  return { variants: parts.slice(0, -1), utility: parts[parts.length - 1] };
}

// Collect every class token that appears on any element of a document.
function collectClassTokens(doc) {
  const tokens = [];
  for (const el of doc.querySelectorAll('[class]')) {
    const raw = el.getAttribute('class') || '';
    for (const tok of raw.split(/\s+/)) {
      if (tok) tokens.push(tok);
    }
  }
  return tokens;
}

// The built-in Tailwind breakpoints — the ONLY responsive prefixes allowed.
const ALLOWED_BREAKPOINTS = new Set(['sm', 'md', 'lg', 'xl', '2xl']);

// Known Tailwind state / conditional variants that are NOT breakpoints. A
// responsive-breakpoint scan must not mistake these for custom breakpoints.
const KNOWN_STATE_VARIANTS = new Set([
  'hover', 'focus', 'focus-within', 'focus-visible', 'active', 'visited',
  'target', 'disabled', 'enabled', 'checked', 'indeterminate', 'default',
  'required', 'valid', 'invalid', 'in-range', 'out-of-range', 'placeholder-shown',
  'autofill', 'read-only', 'read-write', 'empty', 'first', 'last', 'only',
  'odd', 'even', 'first-of-type', 'last-of-type', 'only-of-type', 'dark',
  'motion-safe', 'motion-reduce', 'contrast-more', 'contrast-less', 'print',
  'portrait', 'landscape', 'rtl', 'ltr', 'open', 'before', 'after', 'first-line',
  'first-letter', 'marker', 'selection', 'file', 'backdrop', 'placeholder',
  'group-hover', 'group-focus', 'group-active', 'peer-hover', 'peer-focus',
  'peer-checked', 'forced-colors', 'starting',
]);

// Variant-family prefixes (parametric variants) that are never breakpoints.
const STATE_VARIANT_PREFIXES = [
  'group-', 'peer-', 'aria-', 'data-', 'supports-', 'has-', 'not-', 'in-', 'nth-',
];

function isArbitraryWidthVariant(seg) {
  return /^(min|max)-\[/.test(seg);
}

function isKnownStateVariant(seg) {
  if (KNOWN_STATE_VARIANTS.has(seg)) return true;
  return STATE_VARIANT_PREFIXES.some((p) => seg.startsWith(p));
}

// An interactive element is "icon-only" when it renders no visible text (its
// textContent is empty/whitespace after trimming). Such elements convey meaning
// solely through an icon and therefore require an aria-label (Req 6.3).
function isIconOnly(el) {
  const text = (el.textContent || '').replace(/\s+/g, '').trim();
  return text === '';
}

function ariaLabel(el) {
  return (el.getAttribute('aria-label') || '').trim();
}

// --- 1. Meta viewport (Req 12.1-12.3) ------------------------------------

describe('meta viewport allows zoom on every page (Req 12.1, 12.2, 12.3)', () => {
  it.each(ALL_PAGES)('%s viewport contains initial-scale=1.0 and does not disable zoom', (page) => {
    const { doc } = loadPage(page);
    const meta = doc.querySelector('meta[name="viewport"]');
    expect(meta, `expected a <meta name="viewport"> on ${page}`).toBeTruthy();

    const content = (meta.getAttribute('content') || '').toLowerCase();

    // Req 12.2: initial-scale=1.0 present.
    expect(
      /initial-scale\s*=\s*1(\.0)?/.test(content),
      `${page}: viewport must set initial-scale=1.0 (got "${content}")`
    ).toBe(true);

    // Req 12.3: user-scalable=no must NOT be present (zoom stays enabled).
    expect(
      /user-scalable\s*=\s*no/.test(content),
      `${page}: viewport must NOT set user-scalable=no (got "${content}")`
    ).toBe(false);

    // Req 12.1: maximum-scale must NOT be present (zoom must not be limited).
    expect(
      /maximum-scale/.test(content),
      `${page}: viewport must NOT set maximum-scale (got "${content}")`
    ).toBe(false);
  });
});

// --- 2. Responsive breakpoint consistency (Req 10.1-10.3) ----------------

describe('responsive breakpoints use only built-in Tailwind prefixes (Req 10.1, 10.2, 10.3)', () => {
  it.each(ALL_PAGES)('%s uses no arbitrary min-[...]/max-[...] width variants', (page) => {
    const { doc } = loadPage(page);
    const offenders = [];
    for (const tok of collectClassTokens(doc)) {
      const { variants } = splitToken(tok);
      for (const seg of variants) {
        if (isArbitraryWidthVariant(seg)) offenders.push(tok);
      }
    }
    expect(
      offenders,
      `${page}: arbitrary breakpoint variants are not allowed for layout: ${[...new Set(offenders)].join(', ')}`
    ).toEqual([]);
  });

  it.each(ALL_PAGES)('%s uses no responsive breakpoint prefixes outside sm|md|lg|xl|2xl', (page) => {
    const { doc } = loadPage(page);
    // Any variant segment that is neither an allowed breakpoint nor a known
    // (non-breakpoint) state variant is an unexpected prefix. A custom
    // breakpoint keyword (e.g. `tablet:`, `3xl:`) would surface here.
    const unexpected = new Set();
    for (const tok of collectClassTokens(doc)) {
      const { variants } = splitToken(tok);
      for (const seg of variants) {
        if (ALLOWED_BREAKPOINTS.has(seg)) continue;
        if (isArbitraryWidthVariant(seg)) continue; // covered by the previous test
        if (isKnownStateVariant(seg)) continue;
        unexpected.add(`${seg} (in "${tok}")`);
      }
    }
    expect(
      [...unexpected],
      `${page}: unexpected variant prefixes (possible custom breakpoints) found`
    ).toEqual([]);
  });

  it.each(NAV_PAGES)('%s uses the md: mobile/desktop boundary', (page) => {
    const { doc } = loadPage(page);
    const usesMd = collectClassTokens(doc).some((tok) =>
      splitToken(tok).variants.includes('md')
    );
    expect(usesMd, `${page}: expected at least one md: responsive class (mobile/desktop boundary)`).toBe(true);
  });
});

// --- 3. Icon-only accessibility (Req 6.3) --------------------------------

describe('icon-only buttons and links have a non-empty aria-label (Req 6.3)', () => {
  it.each(ALL_PAGES)('%s: every icon-only <button>/<a> has an aria-label', (page) => {
    const { doc } = loadPage(page);
    const violations = [];

    for (const el of doc.querySelectorAll('button, a')) {
      if (!isIconOnly(el)) continue; // has visible text -> not icon-only
      if (ariaLabel(el)) continue; // has a non-empty aria-label -> OK

      const snippet = el.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 120);
      violations.push(`<${el.tagName.toLowerCase()}> ${snippet}`);
    }

    expect(
      violations,
      `${page}: icon-only interactive elements missing aria-label:\n  ${violations.join('\n  ')}`
    ).toEqual([]);
  });
});
