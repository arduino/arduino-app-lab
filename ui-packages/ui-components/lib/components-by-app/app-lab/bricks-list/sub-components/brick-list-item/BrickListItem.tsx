import { Bricks as BricksIcon } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { forwardRef } from 'react';

import { Skeleton } from '../../../../../skeleton';
import { XSmall, XXSmall } from '../../../../../typography';
import { AiBadge } from '../../../brick-detail/sub-components/ai-badge/AiBadge';
import BrickIcon from '../../../brick-icon/BrickIcon';
import styles from './brick-list-item.module.scss';
import { BricksListItemProps } from './BrickListItem.type';

export const BrickListItem = forwardRef<HTMLButtonElement, BricksListItemProps>(
  (props: BricksListItemProps, ref) => {
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
        ref={ref}
        type="button"
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
              {brick?.require_model && <AiBadge />}
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
  },
);

BrickListItem.displayName = 'BrickListItem';
