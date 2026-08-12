import clsx from 'clsx';

import { useTooltip } from '../../../../../tooltip';
import styles from './board-hardware.module.scss';

export interface BoardHardwareProps {
  title: string;
  label?: string;
  icon: React.ReactNode;
  warning?: boolean;
}

export const BoardHardware = ({
  title,
  label,
  icon,
  warning = false,
}: BoardHardwareProps): JSX.Element => {
  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: label,
    direction: 'up',
    timeout: 0,
  });

  return (
    <div
      className={clsx(styles['board-hardware'], {
        [styles['board-hardware-warning']]: warning,
      })}
      {...tooltipProps}
    >
      {icon}
      <span className={styles['board-hardware-title']}>{title}</span>
      {renderTooltip(styles['tooltip-content--label'])}
    </div>
  );
};
