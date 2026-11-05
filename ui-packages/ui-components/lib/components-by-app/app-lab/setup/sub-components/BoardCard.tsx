import clsx from 'clsx';

import { ArcSpinner as Loader } from '../../../../essential/loader';
import { useI18n } from '../../../../i18n/useI18n';
import { Small, XSmall } from '../../../../typography';
import {
  Badge,
  BadgeSize,
  BadgeStyle,
  BadgeVariant,
} from '../../essential/badge';
import { useTooltip } from '../../essential/tooltip';
import { tooltipMessages, welcomeMessages } from '../messages';
import styles from './board-card.module.scss';

const formatLastConnection = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const day = date.toLocaleString('en-GB', { day: 'numeric' });
    const month = date.toLocaleString('en-GB', { month: 'short' });
    const time = date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${day} ${month} at ${time}`;
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
  isLoading?: boolean;
}

const BoardCard: React.FC<BoardCardProps> = (props: BoardCardProps) => {
  const {
    title,
    description,
    chip,
    onClick,
    ChipIcon,
    Icon,
    disabled = false,
    isNew,
    lastConnection,
    variant = 'single',
    isLoading = false,
  } = props;

  const { formatMessage } = useI18n();
  const isMulti = variant === 'multi';

  const chipTooltip = useTooltip({
    content: formatMessage(tooltipMessages.chipConnectionTooltip, { chip }),
    tooltipType: 'title',
    direction: 'up',
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
      <div
        className={clsx(
          styles['icon'],
          isMulti && styles['icon--small'],
          isLoading && styles['icon--loading'],
        )}
      >
        {isLoading ? <Loader /> : Icon}
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
            <Badge
              size={BadgeSize.Small}
              style={BadgeStyle.Light}
              variant={BadgeVariant.Warning}
              classes={{ container: styles['new-badge'] }}
            >
              {formatMessage(welcomeMessages.newBoardBadge)}
            </Badge>
          )}
        </div>

        {!isMulti && isNew && (
          <Badge
            style={BadgeStyle.Light}
            variant={BadgeVariant.Warning}
            classes={{ container: styles['new-badge'] }}
          >
            {formatMessage(welcomeMessages.newBoardBadge)}
          </Badge>
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
