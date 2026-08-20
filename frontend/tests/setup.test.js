import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Smoke test for the test harness (Task 1): confirms Vitest runs, the jsdom
// environment provides a DOM, and fast-check is wired up for property-based
// testing used by later tasks (RBAC filtering, active-nav, menu consistency).
describe('test harness', () => {
  it('runs under the jsdom environment (document is available)', () => {
    expect(typeof document).toBe('object');
    const el = document.createElement('div');
    el.id = 'app-sidebar';
    document.body.appendChild(el);
    expect(document.getElementById('app-sidebar')).toBe(el);
  });

  it('has fast-check available for property-based testing', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => a + b === b + a),
      { numRuns: 100 }
    );
  });
});
