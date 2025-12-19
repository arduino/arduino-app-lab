import clsx from 'clsx';
import { uniqueId } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

import { XXSmall } from '../typography';
import styles from './tooltip.module.scss';

interface UseTooltipParams {
  content: React.ReactNode;
  title?: string;
  timeout?: number;
  triggerType?: 'hover' | 'click';
  tooltipType?: 'title' | 'tooltip';
  renderDelay?: number;
  direction?: 'down' | 'up';
}

type UseTooltip = (params: UseTooltipParams) => {
  props: {
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onPress?: () => void;
    'aria-describedby': string | undefined;
  };
  renderTooltip: (className?: string) => JSX.Element;
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
  direction = 'down',
}: UseTooltipParams) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutId = useRef<number | null>(null);
  const [id, setId] = useState<string>();

  useEffect(() => {
    setId(`tooltip-${uniqueId()}`);
  }, []);

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
      return (
        <div
          role="tooltip"
          id={id}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={clsx(
            className,
            styles['tooltip'],
            showTooltip && styles['tooltip-show'],
            tooltipType === 'title' && styles['tooltip--title'],
            direction === 'up' && styles['tooltip-up'],
          )}
        >
          {title && (
            <div>
              <XXSmall bold>{title}</XXSmall>
            </div>
          )}
          <XXSmall>{content}</XXSmall>
        </div>
      );
    },
    [
      content,
      direction,
      handleMouseEnter,
      handleMouseLeave,
      id,
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
    },
    renderTooltip,
    setShowTooltip,
    isTooltipVisible: showTooltip,
  };
};
