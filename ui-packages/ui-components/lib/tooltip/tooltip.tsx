import clsx from 'clsx';
import { uniqueId } from 'lodash-es';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { XXSmall } from '../typography';
import styles from './tooltip.module.scss';

interface UseTooltipParams {
  content: React.ReactNode;
  title?: string;
  timeout?: number;
  triggerType?: 'hover' | 'click';
  renderDelay?: number;

  /**
   * @deprecated to be removed, now the tooltip will automatically determine the best direction to open based on available space.
   */
  direction?: 'down' | 'up' | 'right' | 'up-right';
  /**
   * @deprecated to be removed, the style now is added from the wrapper on the respective app.
   */
  tooltipType?: 'title' | 'tooltip';
}

type UseTooltip = (params: UseTooltipParams) => {
  props: {
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onPress?: () => void;
    'aria-describedby': string | undefined;
    ref?: React.RefObject<HTMLDivElement>;
  };
  renderTooltip: (className?: string) => JSX.Element | null;
  isTooltipVisible: boolean;
  setShowTooltip: (show: boolean) => void;
};

export const useTooltip: UseTooltip = ({
  content,
  title,
  timeout = 1000,
  renderDelay = 0,
  tooltipType = 'tooltip',
  triggerType = 'hover',
}: UseTooltipParams) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    transform?: string;
  } | null>(null);
  const tooltipTimeoutId = useRef<number | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [id, setId] = useState<string>();

  useEffect(() => {
    setId(`tooltip-${uniqueId()}`);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left + triggerRect.width / 2;
    const spaceRight =
      window.innerWidth - triggerRect.right + triggerRect.width / 2;

    let newTop: number | undefined;
    let newBottom: number | undefined;
    let newLeft: number | undefined;
    let newRight: number | undefined;
    let transform: string | undefined;

    // Vertical positioning
    if (spaceBelow >= tooltipRect.height + 8 || spaceBelow >= spaceAbove) {
      // Prefer bottom
      newTop = triggerRect.bottom + 8;
    } else {
      // Fallback to top
      newBottom = window.innerHeight - triggerRect.top + 8;
    }

    // Horizontal positioning
    if (
      spaceRight >= tooltipRect.width / 2 &&
      spaceLeft >= tooltipRect.width / 2
    ) {
      // Center horizontally
      newLeft = triggerRect.left + triggerRect.width / 2;
      transform = 'translateX(-50%)';
    } else if (spaceRight >= tooltipRect.width) {
      // Align to left of element
      newLeft = triggerRect.left;
    } else if (spaceLeft >= tooltipRect.width) {
      // Align to right of element
      newRight = window.innerWidth - triggerRect.right;
    } else {
      // Best effort left aligned
      newLeft = 8;
    }

    setPosition({
      top: newTop,
      bottom: newBottom,
      left: newLeft,
      right: newRight,
      transform,
    });
  }, []);

  useLayoutEffect(() => {
    if (showTooltip) {
      updatePosition();
      // Re-calculate position on resize/scroll for robustness
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [showTooltip, updatePosition]);

  const handleClick = useCallback(() => {
    if (tooltipTimeoutId.current) {
      window.clearTimeout(tooltipTimeoutId.current);
    }
    setShowTooltip(true);
    tooltipTimeoutId.current = window.setTimeout(() => {
      setShowTooltip(false);
    }, timeout);
  }, [timeout]);

  const handleMouseEnter = useCallback(() => {
    if (tooltipTimeoutId.current) {
      window.clearTimeout(tooltipTimeoutId.current);
    }

    tooltipTimeoutId.current = window.setTimeout(() => {
      setShowTooltip(true);
    }, renderDelay);
  }, [renderDelay]);

  const handleMouseLeave = useCallback(() => {
    if (tooltipTimeoutId.current) {
      window.clearTimeout(tooltipTimeoutId.current);
    }

    tooltipTimeoutId.current = window.setTimeout(() => {
      setShowTooltip(false);
    }, timeout);
  }, [timeout]);

  const renderTooltip = useCallback(
    (className: string | undefined) => {
      const tooltipContent = (
        <div
          ref={tooltipRef}
          role="tooltip"
          id={id}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={clsx(className, styles['tooltip'], {
            [styles['tooltip-show']]: showTooltip,
            [styles['tooltip--title']]: tooltipType === 'title',
          })}
          style={{
            position: 'fixed',
            top: position?.top,
            bottom: position?.bottom,
            left: position?.left,
            right: position?.right,
            transform: position?.transform,
            opacity: position ? 1 : 0, // Hide until positioned
            pointerEvents: position ? 'auto' : 'none',
          }}
        >
          {title && (
            <div className={styles['tooltip-title']}>
              <XXSmall bold>{title}</XXSmall>
            </div>
          )}
          <XXSmall>{content}</XXSmall>
        </div>
      );

      return createPortal(tooltipContent, document.body);
    },
    [
      content,
      handleMouseEnter,
      handleMouseLeave,
      id,
      position,
      showTooltip,
      title,
      tooltipType,
    ],
  );

  return {
    props: {
      ...(triggerType === 'hover' && {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      }),
      ...(triggerType === 'click' && {
        onPress: handleClick,
      }),
      'aria-describedby': id,
      ref: triggerRef,
    },
    renderTooltip,
    setShowTooltip,
    isTooltipVisible: showTooltip,
  };
};
