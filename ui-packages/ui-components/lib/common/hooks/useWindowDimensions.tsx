// ----------------------------------------------------------------------
// IMPORTED FILE
//
// This code was imported from a external library to handle private
// dependencies required for the main application to run.
// ----------------------------------------------------------------------

import { useLayoutEffect, useState } from 'react';

export const useWindowDimensions = (
  innerWidth: number,
  events?: {
    onEnter?: () => void;
    onExit?: () => void;
  },
): boolean | undefined => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMobileSize, setIsMobileSize] = useState<boolean | undefined>(
    window.innerWidth <= innerWidth,
  );

  useLayoutEffect(() => {
    setIsHydrated(true); // Mark hydration complete
    setIsMobileSize(window.innerWidth <= innerWidth); // Correct value on mount

    const windowResizeHandler = (): void => {
      const matchMediaString = `(max-width: ${innerWidth}px)`;

      if (matchMedia(matchMediaString).matches) {
        setIsMobileSize((v) => {
          if (!v && events?.onEnter) events.onEnter();
          return true;
        });
      } else {
        setIsMobileSize((v) => {
          if (v && events?.onExit) events.onExit();
          return false;
        });
      }
    };

    window.addEventListener('resize', windowResizeHandler);
    return () => window.removeEventListener('resize', windowResizeHandler);
  }, [events, innerWidth]);

  return isHydrated ? isMobileSize : undefined;
};
