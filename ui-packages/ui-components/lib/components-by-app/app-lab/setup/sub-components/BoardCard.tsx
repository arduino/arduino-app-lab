import clsx from 'clsx';

import { useI18n } from '../../../../i18n/useI18n';
import { useTooltip } from '../../../../tooltip';
import { Small, XSmall, XXSmall } from '../../../../typography';
import { tooltipMessages, welcomeMessages } from '../messages';
import styles from './board-card.module.scss';

const formatLastConnection = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

interface BoardCardProps {
  title: string;
  description?: string;
  chip: string;
  onClick?: () => void;
  ChipIcon: React.ReactNode;
  Icon: React.ReactNode;
  disabled?: boolean;
  isNew?: boolean;
  lastConnection?: string;
  variant?: 'single' | 'multi';
}

const BoardCard: React.FC<BoardCardProps> = (props: BoardCardProps) => {
  const {
    title,
    description,
    chip,
    onClick,
    ChipIcon,
    Icon,
    disabled,
    isNew,
    lastConnection,
    variant = 'single',
  } = props;

  const { formatMessage } = useI18n();
  const isMulti = variant === 'multi';

  const chipTooltip = useTooltip({
    content: formatMessage(tooltipMessages.chipConnectionTooltip, { chip }),
    tooltipType: 'title',
    direction: 'up',
    timeout: 0,
  });

  const circledChipIcon = (
    <div {...chipTooltip.props} className={styles['chip-icon-wrapper']}>
      {ChipIcon}
      {chipTooltip.renderTooltip(styles['chip-tooltip'])}
    </div>
  );

  return (
    <button
      className={clsx(styles['board'], styles[`board--${variant}`])}
      onClick={onClick}
      disabled={disabled || !onClick}
    >
      <div className={clsx(styles['icon'], isMulti && styles['icon--small'])}>
        {Icon}
      </div>

      <div className={styles['main-content']}>
        <div className={styles['title-row']}>
          <Small
            bold
            className={clsx(
              styles['title'],
              isMulti && !isNew && styles['title--with-badge'],
            )}
            truncate
          >
            {title}
          </Small>

          {isMulti && isNew && (
            <div className={styles['new-badge']}>
              <XXSmall uppercase>
                {formatMessage(welcomeMessages.newBoardBadge)}
              </XXSmall>
            </div>
          )}
        </div>

        {!isMulti && isNew && (
          <div className={styles['new-badge']}>
            <XXSmall uppercase>
              {formatMessage(welcomeMessages.newBoardBadge)}
            </XXSmall>
          </div>
        )}

        {lastConnection && (
          <XSmall className={styles['last-connection']}>
            {formatMessage(welcomeMessages.lastConnectionPrefix)}{' '}
            {formatLastConnection(lastConnection)}
          </XSmall>
        )}
      </div>

      <div className={styles['trailing']}>
        {description && <XSmall uppercase>{description}</XSmall>}
        {circledChipIcon}
      </div>
    </button>
  );
};

export default BoardCard;
