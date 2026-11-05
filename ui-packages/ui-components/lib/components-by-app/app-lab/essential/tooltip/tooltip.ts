import clsx from 'clsx';

import { useTooltip as useEssentialTooltip } from '../../../../tooltip';
import styles from './tooltip.module.scss';

type UseTooltipParams = Parameters<typeof useEssentialTooltip>[0] & {
  variant?: 'label' | 'card';
};

export const useTooltip = (
  params: UseTooltipParams,
): ReturnType<typeof useEssentialTooltip> => {
  const tooltip = useEssentialTooltip({
    ...params,
    timeout: params.timeout ?? 0,
    renderDelay: params.renderDelay ?? 300,
  });

  return {
    ...tooltip,
    renderTooltip: (className?: string) =>
      tooltip.renderTooltip(
        clsx(
          styles.tooltip,
          params.variant === 'card' && styles.card,
          className,
        ),
      ),
  };
};
