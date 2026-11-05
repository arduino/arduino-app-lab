import { ThreeDots } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { Key, ReactNode } from 'react';

import { DropdownMenuButton } from '../../../../essential/dropdown-menu';
import { ArcSpinner } from '../../../../essential/loader';
import { XSmall, XXSmall, XXXSmall } from '../../../shared';
import styles from './banner.module.scss';

export type BannerAction = {
  id: string;
  label: string;
  labelPrefix?: ReactNode;
  truncateLabel?: boolean;
  danger?: boolean;
  onSelect: () => void;
};

type BannerProgressRow = {
  id: string;
  label: string;
  progress?: number;
};

export type BannerProps = (
  | {
      type: 'waiting';
      title: string;
      description: string;
    }
  | {
      type: 'loading';
      title: string;
      progress?: number;
    }
  | {
      type: 'operation';
      title: string;
      description: string;
      // One box per operation.
      rows: BannerProgressRow[];
      actions?: BannerAction[];
    }
) & { className?: string };

const ProgressBar = ({ progress }: { progress: number }): JSX.Element => (
  <div className={styles['progress-bar']}>
    <div className={clsx(styles['progress'], styles[`p${progress}`])} />
  </div>
);

const IndeterminateBar = (): JSX.Element => (
  <div className={styles['waiting-indicator']}>
    <div className={styles['indicator']} />
  </div>
);

export const Banner = (props: BannerProps): JSX.Element => {
  switch (props.type) {
    case 'waiting':
      return (
        <div
          className={clsx(styles['banner'], styles['waiting'], props.className)}
        >
          <XSmall className={styles['banner-title']}>{props.title}</XSmall>
          <XXSmall className={styles['banner-description']}>
            {props.description}
          </XXSmall>
          <div className={styles['waiting-indicator']}>
            <div className={styles['indicator']} />
          </div>
        </div>
      );
    case 'loading':
      return (
        <div
          className={clsx(styles['banner'], styles['loading'], props.className)}
        >
          {props.progress != null ? (
            <ProgressBar progress={props.progress} />
          ) : null}
          <div className={styles['banner-content']}>
            <ArcSpinner />
            <XXXSmall className={styles['banner-title']}>
              {props.title}
            </XXXSmall>
            {props.progress != null ? (
              <XXSmall className={styles['banner-description']}>
                {props.progress}%
              </XXSmall>
            ) : null}
          </div>
        </div>
      );
    case 'operation': {
      const { actions, rows } = props;

      return (
        <div
          className={clsx(
            styles['banner'],
            styles['operation'],
            props.className,
          )}
        >
          <div className={styles['operation-header']}>
            <XSmall className={styles['banner-title']}>{props.title}</XSmall>
            {actions?.length ? (
              <DropdownMenuButton
                sections={[
                  {
                    name: 'operation-actions',
                    items: actions.map((action) => ({
                      id: action.id,
                      label: action.label,
                      labelPrefix: action.labelPrefix,
                      ...(action.truncateLabel
                        ? {
                            node: (
                              <>
                                {action.labelPrefix}
                                <span
                                  className={styles['operation-action-label']}
                                >
                                  {action.label}
                                </span>
                              </>
                            ),
                          }
                        : {}),
                      ...(action.danger
                        ? { itemClassName: styles['danger'] }
                        : {}),
                    })),
                  },
                ]}
                onAction={(key: Key): void =>
                  actions.find((action) => action.id === key)?.onSelect()
                }
                useStaticPosition={false}
                // Opens on press: an item drawn under the pointer would run on release.
                placement="bottom end"
                buttonChildren={<ThreeDots />}
                classes={{
                  dropdownMenuButton: styles['operation-actions-button'],
                  dropdownMenuItem: styles['operation-actions-item'],
                }}
              />
            ) : null}
          </div>
          <XXXSmall className={styles['banner-description']}>
            {props.description}
          </XXXSmall>
          {rows.map((row) => (
            <div key={row.id} className={styles['operation-progress']}>
              {row.progress != null ? (
                <ProgressBar progress={row.progress} />
              ) : (
                <IndeterminateBar />
              )}
              <div className={styles['banner-content']}>
                <ArcSpinner />
                <XXXSmall className={styles['banner-title']}>
                  {row.label}
                </XXXSmall>
                {row.progress != null ? (
                  <XXSmall className={styles['banner-description']}>
                    {row.progress}%
                  </XXSmall>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      );
    }
  }
};
