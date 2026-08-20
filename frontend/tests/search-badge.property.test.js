// Feature: santri-pengabdian-khidmah, Property 7: Render hasil pencarian santri pengabdian.
// Untuk setiap item hasil pencarian bertipe `santri` yang `data_utama.status`-nya
// `pengabdian`, fungsi penentu tampilan (searchBadgeFor) menghasilkan label
// `PENGABDIAN` (bukan `SANTRI` maupun `ALUMNI`) dan subteks yang memuat nilai
// `khidmah_tempat`; untuk status selain `pengabdian`, label yang dihasilkan bukan
// `PENGABDIAN`.
// Validates: Requirements 5.2, 5.3

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Importing xss.js registers DOMContentLoaded handlers and patches
// Response.prototype.json as a side effect; in jsdom this is harmless. It also
// exports the pure helper searchBadgeFor used below.
import { searchBadgeFor } from '../src/js/xss.js';

// Non-empty, non-whitespace khidmah_tempat so it is truthy and can be found in
// the generated subtext. fast-check strings may include control chars, so we
// constrain to a readable range and require a non-blank trimmed value.
const khidmahTempatArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim().length > 0);

// Any status that is NOT 'pengabdian': the known lifecycle values plus arbitrary
// strings to exercise unexpected inputs.
const nonPengabdianStatusArb = fc.oneof(
  fc.constantFrom('aktif', 'cuti', 'lulus', 'boyong', 'keluar', ''),
  fc.string().filter((s) => s !== 'pengabdian')
);

describe('Property 7: searchBadgeFor renders PENGABDIAN badge for pengabdian santri', () => {
  it('labels pengabdian santri PENGABDIAN with subtext containing khidmah_tempat', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        khidmahTempatArb,
        (id, khidmahTempat) => {
          const item = {
            tipe: 'santri',
            id,
            data_utama: { status: 'pengabdian', khidmah_tempat: khidmahTempat },
          };

          const { label, subtext, href } = searchBadgeFor(item);

          // Label is PENGABDIAN, and never SANTRI or ALUMNI.
          expect(label).toBe('PENGABDIAN');
          expect(label).not.toBe('SANTRI');
          expect(label).not.toBe('ALUMNI');

          // Subtext carries the khidmah_tempat value.
          expect(subtext).toContain(khidmahTempat);

          // Navigation stays consistent with other santri.
          expect(href).toBe(`/profil-santri.html?id=${id}`);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('never labels a non-pengabdian santri PENGABDIAN', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        nonPengabdianStatusArb,
        fc.option(fc.string(), { nil: undefined }),
        (id, status, khidmahTempat) => {
          const item = {
            tipe: 'santri',
            id,
            data_utama: { status, khidmah_tempat: khidmahTempat },
          };

          const { label } = searchBadgeFor(item);

          expect(label).not.toBe('PENGABDIAN');
        }
      ),
      { numRuns: 200 }
    );
  });
});
