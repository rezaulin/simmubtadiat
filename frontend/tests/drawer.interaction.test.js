// Feature: mobile-responsive-ui, Task 3.2: Unit/interaction tests for drawer behavior
// Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
//
// These are example-based interaction tests (NOT property tests). They load the
// canonical drawer markup into jsdom, call initSidebar() to wire the handlers,
// then drive interactions (hamburger, close button, backdrop, Escape, nav-link
// tap, resize) and assert the resulting class changes on the drawer, backdrop,
// and document.body.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Importing xss.js exposes initSidebar plus RBAC/active-nav helpers. It also
// registers a DOMContentLoaded handler that auto-calls initSidebar(); that
// handler does not run during these tests because DOMContentLoaded has already
// fired, so we call initSidebar() explicitly against the DOM we build.
import { initSidebar } from '../src/js/xss.js';

// jsdom does not implement window.matchMedia. initSidebar() only reads it at
// event time (nav-link tap uses `(max-width: 767px)`, resize uses
// `(min-width: 768px)`), so we install a stub that evaluates those queries
// against a controllable viewport width.
function setViewportWidth(width) {
  window.matchMedia = (query) => {
    let matches = false;
    const maxMatch = query.match(/max-width:\s*(\d+)px/);
    const minMatch = query.match(/min-width:\s*(\d+)px/);
    if (maxMatch) matches = width <= parseInt(maxMatch[1], 10);
    else if (minMatch) matches = width >= parseInt(minMatch[1], 10);
    return {
      matches,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    };
  };
}

// Canonical drawer markup (mirrors index.html): the drawer starts closed on
// mobile (`-translate-x-full`) with `md:translate-x-0` for the fixed desktop
// state, the backdrop starts `hidden`, and the top bar carries the hamburger.
function buildDrawerDom() {
  document.body.innerHTML = `
    <header class="md:hidden">
      <button id="btn-open-sidebar" aria-label="Buka menu">menu</button>
      <button id="theme-toggle-mobile" aria-label="Ganti tema">moon</button>
    </header>
    <aside id="app-sidebar"
      class="flex flex-col w-64 fixed inset-y-0 left-0 transition-transform transform -translate-x-full md:translate-x-0">
      <button id="btn-close-sidebar" class="md:hidden" aria-label="Tutup menu">x</button>
      <nav>
        <a href="/index.html" data-nav>Beranda</a>
        <a href="/absensi.html" data-nav>Absensi</a>
        <a href="/rapot.html" data-nav>Rapot</a>
      </nav>
    </aside>
    <div id="sidebar-backdrop" class="hidden md:hidden fixed inset-0"></div>
  `;
}

// Convenience accessors for the elements under test.
const sidebar = () => document.getElementById('app-sidebar');
const backdrop = () => document.getElementById('sidebar-backdrop');

// A drawer is "open" when the transform-out class is gone, the backdrop is
// visible, and the body scroll lock is engaged.
function expectOpen() {
  expect(sidebar().classList.contains('-translate-x-full')).toBe(false);
  expect(backdrop().classList.contains('hidden')).toBe(false);
  expect(document.body.classList.contains('overflow-hidden')).toBe(true);
  expect(document.body.classList.contains('md:overflow-auto')).toBe(true);
}

// A drawer is "closed" when it is transformed out, the backdrop is hidden, and
// the body scroll lock is released.
function expectClosed() {
  expect(sidebar().classList.contains('-translate-x-full')).toBe(true);
  expect(backdrop().classList.contains('hidden')).toBe(true);
  expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  expect(document.body.classList.contains('md:overflow-auto')).toBe(false);
}

describe('drawer behavior (Requirements 2.1-2.7)', () => {
  beforeEach(() => {
    // Default to a mobile viewport for the interaction scenarios.
    setViewportWidth(375);
    buildDrawerDom();
    initSidebar();
  });

  afterEach(() => {
    document.body.className = '';
    document.body.innerHTML = '';
  });

  it('Req 2.1: opens the drawer and shows the backdrop when the hamburger is pressed', () => {
    // Starts closed.
    expect(sidebar().classList.contains('-translate-x-full')).toBe(true);
    expect(backdrop().classList.contains('hidden')).toBe(true);

    document.getElementById('btn-open-sidebar').click();

    expectOpen();
  });

  it('Req 2.2: closes the drawer and hides the backdrop when the close button is pressed', () => {
    window.openSidebar();
    expectOpen();

    document.getElementById('btn-close-sidebar').click();

    expectClosed();
  });

  it('Req 2.3: closes the drawer when the backdrop is tapped', () => {
    window.openSidebar();
    expectOpen();

    backdrop().click();

    expectClosed();
  });

  it('Req 2.4: closes the drawer when Escape is pressed while it is open', () => {
    window.openSidebar();
    expectOpen();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expectClosed();
  });

  it('Req 2.5: closes the drawer when a nav link is tapped on a mobile viewport', () => {
    setViewportWidth(375); // mobile: (max-width: 767px) matches
    window.openSidebar();
    expectOpen();

    sidebar().querySelector('nav a').click();

    expectClosed();
  });

  it('Req 2.5: does NOT close the drawer when a nav link is tapped on a desktop viewport', () => {
    setViewportWidth(1024); // desktop: (max-width: 767px) does NOT match
    window.openSidebar();
    expectOpen();

    sidebar().querySelector('nav a').click();

    // Still open: link taps only auto-close on mobile.
    expectOpen();
  });

  it('Req 2.6: locks body scroll on open and releases it on close', () => {
    // Locked on open.
    window.openSidebar();
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    expect(document.body.classList.contains('md:overflow-auto')).toBe(true);

    // Released on close.
    window.closeSidebar();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    expect(document.body.classList.contains('md:overflow-auto')).toBe(false);
  });

  it('Req 2.7: resets the drawer and backdrop to the desktop state on resize past 768px', () => {
    window.openSidebar();
    expectOpen();

    // Simulate resizing up to a desktop viewport: (min-width: 768px) matches.
    setViewportWidth(1024);
    window.dispatchEvent(new Event('resize'));

    // Backdrop hidden, scroll lock released, drawer transformed out (the fixed
    // desktop state is restored by md:translate-x-0 in CSS).
    expect(backdrop().classList.contains('hidden')).toBe(true);
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    expect(document.body.classList.contains('md:overflow-auto')).toBe(false);
    expect(sidebar().classList.contains('-translate-x-full')).toBe(true);
  });

  it('does not throw when the drawer markup is absent (guard clause)', () => {
    document.body.innerHTML = '<div>no drawer here</div>';
    expect(initSidebar()).toBeNull();
  });
});
