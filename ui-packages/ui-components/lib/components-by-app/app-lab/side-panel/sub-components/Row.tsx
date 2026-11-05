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
  // the trailing element is a control of its own (e.g. a menu button), so it must not act as the row
  trailingIsInteractive?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
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
  trailingIsInteractive,
  ariaExpanded,
  ariaControls,
  className,
}: RowProps): JSX.Element => {
  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: title,
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

  const trailingNode = trailing ? (
    <div
      className={clsx(styles['trailing'], {
        [styles['trailing-reveal']]: revealTrailingOnHover,
      })}
    >
      {trailing}
    </div>
  ) : null;

  // The whole row is the click target; only a trailing that owns its clicks, or a link's, stays outside it.
  const trailingInsideClickTarget = Boolean(
    trailing && onClick && !route && !trailingIsInteractive,
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
          aria-expanded={ariaExpanded}
          aria-controls={ariaControls}
          onClick={onClick}
          onKeyUp={(e): void => {
            if (e.key === 'Enter' || e.key === ' ') onClick();
          }}
        >
          {content}
          {trailingInsideClickTarget && trailingNode}
        </div>
      ) : (
        <div className={styles['link']}>{content}</div>
      )}
      {!trailingInsideClickTarget && trailingNode}
    </div>
  );
};
