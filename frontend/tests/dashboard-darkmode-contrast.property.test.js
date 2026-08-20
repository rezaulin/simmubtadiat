import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Feature: dashboard-redesign-kalender, Property 2: Kontras Mode_Gelap memenuhi ambang WCAG
//
// Untuk setiap pasangan (warna teks, warna latar) yang didefinisikan pada
// Mode_Gelap, rasio kontras WCAG yang dihitung >= 4.5:1 untuk teks normal dan
// >= 3:1 untuk teks besar / elemen antarmuka.
//
// Validates: Requirements 1.6

// ---------------------------------------------------------------------------
// WCAG 2.x contrast-ratio calculator (relative luminance).
// Reference algorithm:
//   - normalize each sRGB channel to 0..1
//   - linearize: c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4
//   - L = 0.2126*R + 0.7152*G + 0.0722*B
//   - ratio = (Llight + 0.05) / (Ldark + 0.05)
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((ch) => ch + ch).join('')
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function linearizeChannel(channel8bit) {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * linearizeChannel(r) +
    0.7152 * linearizeChannel(g) +
    0.0722 * linearizeChannel(b)
  );
}

function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Real dark-mode (foreground, background) pairs used by the dashboard.
//
// Surfaces (from frontend/style.css @theme + actual markup):
//   - dark-bg      #0f172a (slate-900)  -> page background (.dark body)
//   - dark-surface #1e293b (slate-800)  -> cards / sidebar (dark:bg-slate-800)
//
// Feature tokens: --color-primary #0E7C86, hero gradient #0F6E77 -> #12A2A8,
//                 --color-accent-gold #E0A93B, --color-accent-emerald #10b981.
//
// Text colors observed on the dashboard hero/cards in dark mode:
//   white/#f8fafc (headings/body), gray-200/300/400 (secondary/muted),
//   indigo-400 (links/accents). Semi-transparent badge overlays
//   (e.g. amber-900/50) are excluded since their effective color depends on
//   compositing; the opaque token/slate/gray pairs below are representative.
//
// WCAG threshold applies per usage:
//   - 'normal' : body / secondary text          -> ratio >= 4.5
//   - 'large'  : large hero text / UI accents    -> ratio >= 3.0
// ---------------------------------------------------------------------------

const DARK_BG = '#0f172a';       // --color-dark-bg (slate-900)
const DARK_SURFACE = '#1e293b';  // --color-dark-surface (slate-800)

const PAIRS = [
  // Primary heading / body text on dark surfaces (normal text).
  { fg: '#ffffff', bg: DARK_SURFACE, kind: 'normal', label: 'white on dark-surface (card heading)' },
  { fg: '#ffffff', bg: DARK_BG, kind: 'normal', label: 'white on dark-bg' },
  { fg: '#f8fafc', bg: DARK_BG, kind: 'normal', label: 'slate-50 body text on dark-bg' },
  { fg: '#f8fafc', bg: DARK_SURFACE, kind: 'normal', label: 'slate-50 body text on dark-surface' },

  // Secondary / muted text on dark surfaces (normal text).
  { fg: '#e5e7eb', bg: DARK_SURFACE, kind: 'normal', label: 'gray-200 on dark-surface' },
  { fg: '#d1d5db', bg: DARK_SURFACE, kind: 'normal', label: 'gray-300 on dark-surface' },
  { fg: '#9ca3af', bg: DARK_SURFACE, kind: 'normal', label: 'gray-400 muted on dark-surface' },
  { fg: '#9ca3af', bg: DARK_BG, kind: 'normal', label: 'gray-400 muted on dark-bg' },

  // Link / accent text on dark surface (normal text).
  { fg: '#818cf8', bg: DARK_SURFACE, kind: 'normal', label: 'indigo-400 link on dark-surface' },

  // White text on primary button surface (normal text on interactive control).
  { fg: '#ffffff', bg: '#0E7C86', kind: 'normal', label: 'white on primary button' },

  // Hero: large white heading text over the teal gradient endpoints (large text).
  { fg: '#ffffff', bg: '#0F6E77', kind: 'large', label: 'white on hero gradient start' },
  { fg: '#ffffff', bg: '#12A2A8', kind: 'large', label: 'white on hero gradient end' },

  // UI accents: icons / chart accents / decorative marks (UI elements, >= 3:1).
  { fg: '#E0A93B', bg: DARK_BG, kind: 'large', label: 'accent-gold UI on dark-bg' },
  { fg: '#E0A93B', bg: DARK_SURFACE, kind: 'large', label: 'accent-gold UI on dark-surface' },
  { fg: '#10b981', bg: DARK_SURFACE, kind: 'large', label: 'accent-emerald UI on dark-surface' },
  { fg: '#10b981', bg: DARK_BG, kind: 'large', label: 'accent-emerald UI on dark-bg' },
  { fg: '#0E7C86', bg: DARK_BG, kind: 'large', label: 'primary UI accent on dark-bg' },
];

const THRESHOLD = { normal: 4.5, large: 3.0 };

// Sanity checks for the calculator itself against known WCAG reference values.
describe('WCAG contrast-ratio calculator', () => {
  it('computes the canonical black-on-white ratio of 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('computes a ratio of 1:1 for identical colors', () => {
    expect(contrastRatio('#1e293b', '#1e293b')).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    expect(contrastRatio('#ffffff', '#0f172a')).toBeCloseTo(
      contrastRatio('#0f172a', '#ffffff'),
      10
    );
  });
});

describe('Property 2: dark-mode color pairs meet WCAG contrast thresholds', () => {
  it('every dark-mode text/background pair meets its WCAG threshold', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PAIRS), (pair) => {
        const ratio = contrastRatio(pair.fg, pair.bg);
        const min = THRESHOLD[pair.kind];
        expect(
          ratio,
          `Contrast too low for "${pair.label}" (${pair.fg} on ${pair.bg}): ` +
            `${ratio.toFixed(2)}:1 < required ${min}:1 for ${pair.kind} text`
        ).toBeGreaterThanOrEqual(min);
      }),
      { numRuns: 100 }
    );
  });
});
