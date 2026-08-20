// Feature: mobile-responsive-ui, Property 1: Tautan navigasi yang terlihat sama dengan irisan tautan yang tersedia dan yang diizinkan peran
// Validates: Requirements 4.1, 4.2
//
// This suite loads the canonical navigation markup into jsdom, runs the DOM
// effect `window.applyRoleUI(role)` exported as a side effect of importing
// `../src/js/xss.js`, and asserts that the set of VISIBLE links equals the
// intersection of (links present on the page) and computeAllowedLinks(role).

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

// Importing xss.js registers DOMContentLoaded handlers, patches
// Response.prototype.json, and defines window.applyRoleUI as a side effect.
// It also exports the pure helpers used for the oracle below.
import { MENU_ACCESS, computeAllowedLinks } from '../src/js/xss.js';

// The full universe of navigation hrefs. pimpinan has access to every page,
// so its list is the canonical full set of links that can appear on a page.
const FULL_HREFS = MENU_ACCESS.pimpinan;

// Generator for roles: the six valid roles plus arbitrary strings to exercise
// unknown roles (which resolve to an empty allowed set -> everything hidden).
const roleArb = fc.oneof(
  fc.constantFrom('pimpinan', 'admin', 'mufatish', 'mustahiq', 'muroqib', 'tim_rapot', 'keamanan', 'wali_santri'),
  fc.string()
);

// Generator for the links actually present on a page: a random subset of the
// full href set, drawn independently for the sidebar drawer and the bottom nav.
const subsetArb = fc.subarray(FULL_HREFS);

// Build canonical-ish nav markup: an `aside#app-sidebar > nav` (drawer) and a
// `nav.md:hidden` (bottom nav), each populated from the given href subsets.
function buildNav(sidebarHrefs, bottomHrefs) {
  const sidebarLinks = sidebarHrefs
    .map((h) => `<a href="${h}" data-nav>${h}</a>`)
    .join('');
  const bottomLinks = bottomHrefs
    .map((h) => `<a href="${h}" data-nav>${h}</a>`)
    .join('');

  document.body.innerHTML = `
    <aside id="app-sidebar">
      <nav>${sidebarLinks}</nav>
    </aside>
    <nav class="md:hidden">${bottomLinks}</nav>
  `;
}

// Collect the set of visible hrefs: every nav link that does NOT carry the
// `!hidden` class applied by applyRoleUI.
function visibleHrefs() {
  const links = document.querySelectorAll('aside nav a, nav.md\\:hidden a');
  const visible = new Set();
  links.forEach((link) => {
    // applyRoleUI menyembunyikan link sidebar/shortcut dengan `!hidden` (collapse)
    // dan link Bottom_Nav dengan `invisible`+`pointer-events-none` (tetap memakan
    // ruang agar posisi FAB tak bergeser). Keduanya = tidak terlihat oleh pengguna.
    const hidden = link.classList.contains('!hidden') || link.classList.contains('invisible');
    if (!hidden) {
      visible.add(link.getAttribute('href'));
    }
  });
  return visible;
}

describe('Property 1: visible nav links = intersection(present, allowed(role))', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('visible links equal intersection of present links and role-allowed links', () => {
    fc.assert(
      fc.property(roleArb, subsetArb, subsetArb, (role, sidebarHrefs, bottomHrefs) => {
        // applyRoleUI queries the live document, so rebuild the DOM each run.
        buildNav(sidebarHrefs, bottomHrefs);

        window.applyRoleUI(role);

        // Oracle: intersection of the links present on the page and the links
        // the role is allowed to see.
        const present = new Set([...sidebarHrefs, ...bottomHrefs]);
        const allowed = new Set(computeAllowedLinks(role));
        const expected = new Set([...present].filter((h) => allowed.has(h)));

        expect(visibleHrefs()).toEqual(expected);
      }),
      { numRuns: 200 }
    );
  });
});
