import { describe, expect, it } from 'vitest';

import { submenuPosition } from './submenuPosition';

// A 320px menu whose left edge is at x 680, with the anchor row at y 600.
const menu = { top: 470, left: 680 };
const row = { top: 600, left: 684 };

describe('submenuPosition', () => {
  it('opens to the left of the menu, its first row level with the anchor row', () => {
    expect(
      submenuPosition({ menu, row }, { width: 320, height: 100 }, 800),
    ).toEqual({ top: 596, left: 356 });
  });

  it('moves up by as much as it would run past the window bottom', () => {
    // 596 + 280 = 876, past 800 - 8.
    expect(
      submenuPosition({ menu, row }, { width: 320, height: 280 }, 800).top,
    ).toBe(792 - 280);
  });

  it('never moves above the window top', () => {
    expect(
      submenuPosition({ menu, row }, { width: 320, height: 900 }, 800).top,
    ).toBe(8);
  });

  it('never moves past the window left edge', () => {
    expect(
      submenuPosition(
        { menu: { top: 470, left: 200 }, row },
        { width: 320, height: 100 },
        800,
      ).left,
    ).toBe(8);
  });
});
