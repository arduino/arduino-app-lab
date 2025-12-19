// ----------------------------------------------------------------------
// IMPORTED FILE
//
// This code was imported from a external library to handle private
// dependencies required for the main application to run.
// ----------------------------------------------------------------------

import { useMemo } from 'react';

/**
 * Merges an array of refs into a single memoized callback ref or `null`.
 */
export function useMergeRefs<Instance>(
  refs: Array<React.Ref<Instance> | undefined>,
): React.RefCallback<Instance> | null {
  return useMemo(() => {
    if (refs.every((ref) => ref == null)) {
      return null;
    }

    return (value) => {
      refs.forEach((ref) => {
        if (typeof ref === 'function') {
          ref(value);
        } else if (ref != null) {
          // eslint-disable-next-line no-param-reassign
          (ref as React.MutableRefObject<Instance | null>).current = value;
        }
      });
    };
  }, [refs]);
}
