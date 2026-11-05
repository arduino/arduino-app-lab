import { useEffect, useRef } from 'react';

// Close an open picker on outside-click or Escape; shared by every Picker consumer (composer
// pickers, the workspace picker, the agent panel's history menu), which the user reads as one rule.
export const usePickerDismiss = (
  isOpen: boolean,
  containerRef: React.RefObject<HTMLElement>,
  dismiss: () => void,
  // An element rendered outside the container, such as a second level in a portal, that counts as inside.
  extraRef?: React.RefObject<HTMLElement>,
): void => {
  // Held in a ref so a caller's inline callback doesn't re-bind the listeners on every render.
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !extraRef?.current?.contains(target)
      ) {
        dismissRef.current();
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      const focused = document.activeElement;
      const inside =
        !!focused &&
        (!!containerRef.current?.contains(focused) ||
          !!extraRef?.current?.contains(focused));
      dismissRef.current();
      // Focus left in a menu that closes falls to the body: put it back on the trigger, the container's first button.
      if (inside) {
        containerRef.current?.querySelector<HTMLElement>('button')?.focus();
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return (): void => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, containerRef, extraRef]);
};
