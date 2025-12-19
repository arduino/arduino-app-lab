import { Bricks as BricksIcon } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { AppLabAiBadge } from '../../../app-lab-brick-detail/sub-components/ai-badge/AiBadge';
import BrickIcon from '../../../app-lab-brick-icon/BrickIcon';
import { Skeleton } from '../../../skeleton';
import { XSmall, XXSmall } from '../../../typography';
import styles from './brick-list-item.module.scss';
import { AppLabBricksListItemProps } from './BrickListItem.type';

export const AppLabBrickListItem: React.FC<AppLabBricksListItemProps> = (
  props: AppLabBricksListItemProps,
) => {
  const {
    brick,
    disabledBricks = [],
    selectedBrick,
    expanded = true,
    onClick,
    classes,
    size,
    variant = 'default',
  } = props;

  return (
    <button
      className={clsx(styles['brick-item'], classes?.item, {
        [styles['disabled']]: disabledBricks.some(
          (disabledBrick) => disabledBrick.id === brick?.id,
        ),
        [styles['selected']]: selectedBrick && selectedBrick.id === brick?.id,
        [classes?.itemSelected ?? '']:
          selectedBrick && selectedBrick.id === brick?.id,
      })}
      onClick={(): void => brick && onClick?.(brick)}
    >
      {variant === 'skeleton' ? (
        <div className={styles['brick-item-icon']}>
          <BricksIcon
            className={clsx({
              [styles['brick-item-icon-skeleton']]: variant === 'skeleton',
            })}
          />
        </div>
      ) : (
        <BrickIcon category={brick?.category} size={size} />
      )}
      <div className={clsx(styles['brick-item-text'], classes?.itemText)}>
        {variant === 'default' ? (
          <div className={styles['title-container']}>
            <XSmall className={clsx(styles['title'], classes?.itemTitle)}>
              {brick?.name}
            </XSmall>
            {brick?.require_model && <AppLabAiBadge />}
          </div>
        ) : (
          <div className={styles['title-skeleton']}>
            <Skeleton variant="rect" count={1} />
          </div>
        )}
        {expanded && (
          <>
            {variant === 'default' ? (
              <XXSmall
                className={clsx(
                  styles['description'],
                  classes?.itemDescription,
                )}
              >
                {brick?.description}
              </XXSmall>
            ) : (
              <div className={styles['description-skeleton']}>
                <Skeleton variant="rect" count={1} />
              </div>
            )}
          </>
        )}
      </div>
    </button>
  );
};
