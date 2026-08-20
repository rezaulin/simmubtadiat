// Feature: dashboard-redesign-kalender, Task 1.2: Unit test nilai token & border kartu
// Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.7
//
// Example-based, lint-style STATIC-CONTENT assertions (NOT property tests). They
// read the compiled-source stylesheet `frontend/style.css` from disk and assert
// the "Teal Tenang" theme configuration is defined exactly as specified:
//
//   1. @theme token values (Req 1.1-1.3): the centralized color tokens are
//      declared inside the `@theme { ... }` block with their exact hex values.
//
//   2. Card border (Req 1.4): the centralized `.card` utility renders a 1px
//      border so every card across all pages gets a 1px border.
//
//   3. Graceful degradation (Req 1.7): the `.hero-gradient` utility references
//      the hero tokens via `var(--token, fallback)` so the page still renders
//      if a token is unavailable at render time.
//
// Path resolution mirrors static-markup-scan.test.js: resolve against
// process.cwd() (Vitest runs the frontend suite with cwd at `frontend/`) and
// avoid import.meta.url + fileURLToPath under the jsdom environment.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CSS = readFileSync(resolve(process.cwd(), 'style.css'), 'utf8');

// Extract the contents of the `@theme { ... }` block so token assertions only
// match declarations that are actually inside @theme (not other rules).
function extractThemeBlock(css) {
  const start = css.indexOf('@theme');
  expect(start, 'expected an @theme block in style.css').toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  expect(open, 'expected an opening brace after @theme').toBeGreaterThan(start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error('unterminated @theme block in style.css');
}

// Extract the body of a utility rule by class name (e.g. `.card`, `.hero-gradient`),
// matching only the top-level (non-`.dark`-prefixed) selector declaration.
function extractRuleBody(css, selector) {
  // Match `selector` as a whole rule head: preceded by start/whitespace/brace,
  // not immediately preceded by another selector char (so `.card` won't match
  // `.card-foo`). Then capture up to the matching closing brace.
  const re = new RegExp(`(^|[\\s}])${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\\{`, 'm');
  const m = re.exec(css);
  expect(m, `expected a "${selector}" rule in style.css`).toBeTruthy();
  const open = css.indexOf('{', m.index);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated "${selector}" rule in style.css`);
}

// Assert a token declaration `--name: value;` appears (case-insensitive on the
// hex value, since #0E7C86 and #0e7c86 are the same color).
function expectToken(themeBody, name, value) {
  const re = new RegExp(`${name}\\s*:\\s*${value}\\s*;`, 'i');
  expect(
    re.test(themeBody),
    `@theme must define ${name}: ${value}; (not found in @theme block)`
  ).toBe(true);
}

// --- 1. @theme token values (Req 1.1, 1.2, 1.3) --------------------------

describe('@theme defines the Teal Tenang color tokens with exact values', () => {
  const themeBody = extractThemeBlock(CSS);

  it('defines --color-primary and --color-primary-hover (Req 1.1)', () => {
    expectToken(themeBody, '--color-primary', '#0E7C86');
    expectToken(themeBody, '--color-primary-hover', '#0F6870');
  });

  it('defines hero gradient tokens from #0F6E77 to #12A2A8 (Req 1.2)', () => {
    expectToken(themeBody, '--color-hero-from', '#0F6E77');
    expectToken(themeBody, '--color-hero-to', '#12A2A8');
  });

  it('defines --color-light-bg and --color-accent-gold (Req 1.3)', () => {
    expectToken(themeBody, '--color-light-bg', '#F5F7F5');
    expectToken(themeBody, '--color-accent-gold', '#E0A93B');
  });
});

// --- 2. Card border 1px (Req 1.4) ----------------------------------------

describe('.card utility renders a 1px border (Req 1.4)', () => {
  it('sets border-width: 1px on the centralized .card utility', () => {
    const cardBody = extractRuleBody(CSS, '.card');
    expect(
      /border-width\s*:\s*1px\s*;/.test(cardBody),
      `.card must set border-width: 1px; (got: ${cardBody.trim()})`
    ).toBe(true);
  });
});

// --- 3. Graceful degradation via var(--token, fallback) (Req 1.7) --------

describe('.hero-gradient uses var(--token, fallback) for graceful degradation (Req 1.7)', () => {
  const heroBody = extractRuleBody(CSS, '.hero-gradient');

  it('references --color-hero-from with a fallback value', () => {
    expect(
      /var\(\s*--color-hero-from\s*,\s*[^)]+\)/i.test(heroBody),
      `.hero-gradient must use var(--color-hero-from, <fallback>) (got: ${heroBody.trim()})`
    ).toBe(true);
  });

  it('references --color-hero-to with a fallback value', () => {
    expect(
      /var\(\s*--color-hero-to\s*,\s*[^)]+\)/i.test(heroBody),
      `.hero-gradient must use var(--color-hero-to, <fallback>) (got: ${heroBody.trim()})`
    ).toBe(true);
  });
});
