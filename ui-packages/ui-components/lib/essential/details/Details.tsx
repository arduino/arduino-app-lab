import { ChevronRight } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { memo, ReactNode } from 'react';

import { XSmall } from '../../typography';
import styles from './details.module.scss';

interface DetailsProps {
  summaryNode: ReactNode;
  children: ReactNode;
  Icon?: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  chevronPosition?: 'left' | 'right';
  classes?: {
    details?: string;
    summary?: string;
    summaryLabel?: string;
    icon?: string;
    chevron?: string;
  };
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

const Details: React.FC<DetailsProps> = (props: DetailsProps) => {
  const {
    summaryNode,
    children,
    Icon,
    classes,
    chevronPosition = 'right',
    isOpen = false,
    onToggle,
  } = props;

  return (
    <details
      className={clsx(styles['details'], classes?.details, {
        [styles['open']]: isOpen,
      })}
      {...(isOpen ? { open: true } : {})}
    >
      <summary
        // ** as detailed in: https://github.com/facebook/react/issues/15486
        // ** infinite loops can occur with <details /> elements; when trying
        // ** to use it out-of-the-box as a controlled component. The following
        // ** calls to preventDefault and stopPropagation ensure behavior
        // ** is consistent with that of a controlled component
        onClick={(e): void => {
          e.preventDefault();
          e.stopPropagation();

          onToggle && onToggle(!isOpen);
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>): void => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();

            onToggle && onToggle(!isOpen);
          }
        }}
        className={clsx(styles['details-summary'], classes?.summary)}
      >
        {chevronPosition === 'left'
          ? renderChevron(chevronPosition, isOpen, classes?.chevron)
          : null}
        {Icon ? (
          <Icon
            className={clsx(styles['details-summary-icon'], classes?.icon)}
          />
        ) : null}
        <span
          className={clsx(
            styles['details-summary-label'],
            classes?.summaryLabel,
          )}
        >
          {typeof summaryNode === 'string' ? (
            <XSmall title={summaryNode}>{summaryNode}</XSmall>
          ) : (
            summaryNode
          )}
        </span>
        {chevronPosition === 'right'
          ? renderChevron(chevronPosition, isOpen, classes?.chevron)
          : null}
      </summary>
      {children}
    </details>
  );
};

const renderChevron = (
  position: DetailsProps['chevronPosition'],
  isOpen: boolean,
  chevronClass?: string,
): JSX.Element => (
  <ChevronRight
    className={clsx(styles['details-chevron'], chevronClass, {
      [styles['left']]: position === 'left',
      [styles['open']]: isOpen,
    })}
  />
);

Details.displayName = 'Details';

export default memo(Details);
