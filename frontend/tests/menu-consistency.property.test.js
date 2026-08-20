import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENU_ACCESS } from '../src/js/xss.js';

// Feature: mobile-responsive-ui, Property 2: Peta izin menu konsisten antar halaman.
// Untuk setiap halaman aplikasi yang tercakup dan untuk setiap Peran, daftar
// menuAccess[Peran] yang tertanam pada head-guard sinkron halaman tersebut harus
// sama (set-equal) dengan MENU_ACCESS[Peran] kanonik di xss.js.
// Validates: Requirements 4.3

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '..');

// Covered pages that embed the synchronous head-guard (Requirement 1.x scope).
// Excludes login.html and change-password.html which have no head-guard nav.
const COVERED_PAGES = [
  'index.html', 'santri.html', 'perpindahan.html', 'kelas.html',
  'penilaian.html', 'absensi.html', 'absensi-manual.html', 'rapot.html', 'pengajar.html',
  'dewan-harian.html', 'arsip.html', 'alumni.html',
  'rekap.html', 'settings.html', 'profil-santri.html'
];

// The six canonical roles.
const ROLES = ['pimpinan', 'admin', 'mufatish', 'mustahiq', 'muroqib', 'tim_rapot', 'keamanan', 'wali_santri'];

// Extract the `menuAccess` object literal embedded in a page's head-guard IIFE
// and parse it. The head-guard object contains only array values (no nested
// braces), so a non-greedy `{...}` capture terminates at the object's closing
// brace. The source is trusted local project HTML, so evaluating the captured
// object literal via `new Function` is safe here.
function extractMenuAccess(pageFile) {
  const html = fs.readFileSync(path.join(FRONTEND_DIR, pageFile), 'utf8');
  const match = html.match(/var\s+menuAccess\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!match) {
    throw new Error(`No head-guard menuAccess object found in ${pageFile}`);
  }
  // eslint-disable-next-line no-new-func
  return new Function('return (' + match[1] + ')')();
}

// Compare two lists ignoring order and duplicates (set-equal).
function setEqual(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) {
    if (!sb.has(v)) return false;
  }
  return true;
}

// Pre-parse each covered page's embedded menuAccess once so the property test
// only exercises the comparison logic.
const PAGE_MENU_ACCESS = Object.fromEntries(
  COVERED_PAGES.map((page) => [page, extractMenuAccess(page)])
);

describe('Property 2: head-guard menuAccess is consistent with canonical MENU_ACCESS', () => {
  it('every covered page defines exactly the six canonical roles', () => {
    fc.assert(
      fc.property(fc.constantFrom(...COVERED_PAGES), (page) => {
        const embedded = PAGE_MENU_ACCESS[page];
        // The set of roles defined in each page's menuAccess equals the
        // canonical set of roles.
        expect(new Set(Object.keys(embedded))).toEqual(new Set(ROLES));
        expect(new Set(Object.keys(embedded))).toEqual(new Set(Object.keys(MENU_ACCESS)));
      }),
      { numRuns: 100 }
    );
  });

  it('menuAccess[role] is set-equal to canonical MENU_ACCESS[role] for every page and role', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...COVERED_PAGES),
        fc.constantFrom(...ROLES),
        (page, role) => {
          const embedded = PAGE_MENU_ACCESS[page];
          expect(
            setEqual(embedded[role], MENU_ACCESS[role]),
            `Page ${page} role "${role}" diverges from canonical MENU_ACCESS.\n` +
              `  page:      ${JSON.stringify(embedded[role])}\n` +
              `  canonical: ${JSON.stringify(MENU_ACCESS[role])}`
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
