// ----------------------------------------------------------------------
// IMPORTED FILE
//
// This code was imported from a external library to handle private
// dependencies required for the main application to run.
// ----------------------------------------------------------------------

import clsx from 'clsx';
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useMergeRefs } from '../../common/hooks/useMergeRefs';
import styles from './Scrollable.module.scss';

const max = (val: number, limit: number): number =>
  Number.isNaN(val) ? 0 : Math.min(Math.max(val, 0), limit);

export const Scrollable = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<'div'> & {
    /**
     * The color variant of the shadow.
     * @default light
     */
    variant?: 'light' | 'dark';
    /**
     * The maximum height of the scrollable container.
     */
    maxHeight?: number | 'auto';
    /**
     * The maximum opacity of the shadow.
     */
    maxOpacity?: number;
    /**
     * Callback for the scroll event.
     */
    onInnerScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    contentClassname?: string;
  }
>(function Scrollable(
  {
    className,
    style,
    maxHeight = 500,
    maxOpacity = 0.7,
    children,
    onInnerScroll,
    contentClassname,
    variant = 'light',
    ...rest
  },
  ref,
) {
  const autoHeight = maxHeight === 'auto';

  const scrollableRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mergedRefs = useMergeRefs([scrollableRef, ref]);

  const [currentScroll, setCurrentScroll] = useState(NaN);
  const [calculatedMaxHeight, setCalculatedMaxHeight] = useState<number | null>(
    maxHeight === 'auto' ? null : maxHeight,
  );

  const updateScrollValue = useCallback(() => {
    setCurrentScroll(
      (contentRef.current?.scrollTop || 0) /
        ((contentRef.current?.scrollHeight || 0) -
          (scrollableRef.current?.offsetHeight || 0)),
    );
  }, []);

  // Calculate the maximum height based on the parent container
  const calculateMaxHeightFromParent = useCallback(() => {
    if (scrollableRef.current && !autoHeight) {
      const parentHeight =
        scrollableRef.current.parentElement?.getBoundingClientRect().height ||
        0;
      const calculatedHeight = Math.max(parentHeight, 0);

      setCalculatedMaxHeight(calculatedHeight);
    }
  }, [autoHeight]);

  useLayoutEffect(() => {
    // Calculate initial height and add event listeners
    calculateMaxHeightFromParent();
    window.addEventListener('resize', calculateMaxHeightFromParent);

    return (): void => {
      window.removeEventListener('resize', calculateMaxHeightFromParent);
    };
  }, [calculateMaxHeightFromParent]);

  useLayoutEffect(() => {
    // Avoid stale references
    const copyRef = scrollableRef.current;
    // Observe parent size changes with ResizeObserver if maxHeight isn’t provided
    const observer = new ResizeObserver(calculateMaxHeightFromParent);
    if (copyRef?.parentElement && !autoHeight) {
      observer.observe(copyRef.parentElement);
    }

    return (): void => {
      if (copyRef?.parentElement) observer.unobserve(copyRef.parentElement);
    };
  }, [autoHeight, calculateMaxHeightFromParent, maxHeight]);

  useLayoutEffect(() => {
    updateScrollValue();
  }, [children, updateScrollValue]);

  return (
    <div
      ref={mergedRefs}
      className={clsx(styles.Scrollable, className)}
      style={{
        ...style,
        maxHeight:
          // eslint-disable-next-line no-nested-ternary
          !autoHeight
            ? `${maxHeight}px`
            : calculatedMaxHeight
            ? `${calculatedMaxHeight}px`
            : 'inherit',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0, // Allows for proper scrolling inside flex containers
      }}
      data-variant={variant}
      {...rest}
    >
      <div
        className={styles['Scrollable-shadow']}
        data-side="top"
        style={{
          opacity: max(currentScroll, maxOpacity),
        }}
      ></div>
      <div
        className={styles['Scrollable-shadow']}
        data-side="bottom"
        style={{
          pointerEvents: 'none',
          opacity: max(1 - currentScroll, maxOpacity),
        }}
      ></div>
      <div
        className={clsx(styles['Scrollable-content'], contentClassname)}
        style={{
          maxHeight: 'inherit', // Inherits the calculated maxHeight of the outer div
          overflowY: 'auto',
          flexGrow: 1, // Ensures it fills available space within the outer container
        }}
        ref={contentRef}
        onScroll={(event): void => {
          updateScrollValue();
          onInnerScroll?.(event);
        }}
      >
        {children}
      </div>
    </div>
  );
});
