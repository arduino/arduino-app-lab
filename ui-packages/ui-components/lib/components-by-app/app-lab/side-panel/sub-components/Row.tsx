import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { ReactNode } from 'react';

import { XXSmall } from '../../../../typography';
import { useTooltip } from '../../essential/tooltip';
import styles from './row.module.scss';

export interface RowProps {
  id?: string;
  icon: ReactNode;
  title: string;
  // omit both route and onClick for a non-interactive row (e.g. App Hub/Resources)
  route?: string;
  onClick?: () => void;
  active?: boolean;
  // dims the label/icon (e.g. a muted session row)
  dimmed?: boolean;
  trailing?: ReactNode;
  // reveal the trailing element only on row hover (e.g. session actions menu)
  revealTrailingOnHover?: boolean;
  className?: string;
}

export const Row = ({
  id,
  icon,
  title,
  route,
  onClick,
  active,
  dimmed,
  trailing,
  revealTrailingOnHover,
  className,
}: RowProps): JSX.Element => {
  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: title,
    timeout: 0,
    renderDelay: 500,
  });

  const content = (
    <>
      <span className={styles['icon']}>{icon}</span>
      <div {...tooltipProps} className={styles['label']}>
        <XXSmall truncate>{title}</XXSmall>
        {renderTooltip()}
      </div>
    </>
  );

  return (
    <div
      id={id}
      // aria-current doubles as a CSS-module-independent hook for tests
      aria-current={active ? 'page' : undefined}
      className={clsx(
        styles['row'],
        {
          [styles['active']]: active,
          [styles['dimmed']]: dimmed,
          // Nothing to click: drop the hover highlight and pointer cursor that say otherwise.
          [styles['non-interactive']]: !route && !onClick,
        },
        className,
      )}
    >
      {route ? (
        <Link to={route} className={styles['link']}>
          {content}
        </Link>
      ) : onClick ? (
        <div
          className={styles['link']}
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyUp={(e): void => {
            if (e.key === 'Enter' || e.key === ' ') onClick();
          }}
        >
          {content}
        </div>
      ) : (
        <div className={styles['link']}>{content}</div>
      )}
      {trailing && (
        <div
          className={clsx(styles['trailing'], {
            [styles['trailing-reveal']]: revealTrailingOnHover,
          })}
        >
          {trailing}
        </div>
      )}
    </div>
  );
};
