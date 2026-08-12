import { IconNavigationArrowRight } from '@arduino/react-icons';
import clsx from 'clsx';

import { useI18n } from '../../../../i18n/useI18n';
import { XXSmall } from '../../../shared';
import { useTooltip } from '../../essential/tooltip';
import styles from '../examples-section.module.scss';
import { messages } from '../messages';

export interface RowProps {
  title: string;
  description?: string;
  onSelect?: () => void;
  className?: string;
}

export const Row = ({
  title,
  description,
  onSelect,
  className,
}: RowProps): JSX.Element => {
  const { formatMessage } = useI18n();

  const { props: titleTooltipProps, renderTooltip: renderTitleTooltip } =
    useTooltip({ content: title, timeout: 0 });

  const { props: arrowTooltipProps, renderTooltip: renderArrowTooltip } =
    useTooltip({ content: formatMessage(messages.openExample), timeout: 0 });

  return (
    <button
      type="button"
      className={clsx(styles['examples-row'], className)}
      onClick={onSelect}
    >
      <span className={styles['examples-row-inner']}>
        <div {...titleTooltipProps} className={styles['examples-row-title']}>
          <XXSmall bold truncate className={styles['examples-row-title-text']}>
            {title}
          </XXSmall>
          {renderTitleTooltip()}
        </div>
        <div className={styles['examples-row-description']}>
          {description && (
            <XXSmall
              truncate
              className={styles['examples-row-description-text']}
            >
              {description}
            </XXSmall>
          )}
        </div>
        <div {...arrowTooltipProps} className={styles['examples-row-arrow']}>
          <IconNavigationArrowRight />
          {renderArrowTooltip()}
        </div>
      </span>
    </button>
  );
};
