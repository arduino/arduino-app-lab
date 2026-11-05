import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { clearRenamedInPlace, markRenamedInPlace } from '../openAppFile';
import { useAppScreenKey } from './useAppScreenKey';

// The key at every step of a walk through app ids, from the first one.
const keysAlong = (
  steps: Array<{ appId: string; renamedInPlace?: boolean }>,
): string[] => {
  const { result, rerender } = renderHook(
    ({ appId }) => useAppScreenKey(appId),
    { initialProps: { appId: steps[0].appId } },
  );
  const keys = [result.current];
  steps.slice(1).forEach(({ appId, renamedInPlace }, index) => {
    if (renamedInPlace) {
      markRenamedInPlace(steps[index].appId, appId);
    }
    rerender({ appId });
    keys.push(result.current);
  });
  return keys;
};

afterEach(clearRenamedInPlace);

describe('useAppScreenKey', () => {
  it('keeps the key across every id change a rename in place marked', () => {
    const [first, renamed, renamedAgain] = keysAlong([
      { appId: 'blink' },
      { appId: 'blink-fast', renamedInPlace: true },
      { appId: 'blink-faster', renamedInPlace: true },
    ]);

    expect(renamed).toBe(first);
    expect(renamedAgain).toBe(first);
  });

  it('changes the key for any other id change', () => {
    const [first, other] = keysAlong([
      { appId: 'blink' },
      { appId: 'weather' },
    ]);

    expect(other).not.toBe(first);
  });

  // An app created later under the old name gets the old id back, and it is a different app.
  it('gives a new key to an app that gets the id a rename left behind', () => {
    const [, renamed, oldIdAgain, renamedIdAgain] = keysAlong([
      { appId: 'blink' },
      { appId: 'blink-fast', renamedInPlace: true },
      { appId: 'blink' },
      { appId: 'blink-fast' },
    ]);

    expect(oldIdAgain).not.toBe(renamed);
    expect(renamedIdAgain).not.toBe(oldIdAgain);
    expect(renamedIdAgain).not.toBe(renamed);
  });
});
