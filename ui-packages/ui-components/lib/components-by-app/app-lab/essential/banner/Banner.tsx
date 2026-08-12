import clsx from 'clsx';

import { ArcSpinner } from '../../../../essential/loader';
import { XSmall, XXSmall, XXXSmall } from '../../../shared';
import styles from './banner.module.scss';

export type BannerProps =
  | {
      type: 'waiting';
      title: string;
      description: string;
    }
  | {
      type: 'loading';
      title: string;
      progress?: number;
    };

export const Banner = (props: BannerProps): JSX.Element => {
  switch (props.type) {
    case 'waiting':
      return (
        <div className={clsx(styles['banner'], styles['waiting'])}>
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
        <div className={clsx(styles['banner'], styles['loading'])}>
          {props.progress != null ? (
            <div className={styles['progress-bar']}>
              <div
                className={clsx(
                  styles['progress'],
                  styles[`p${props.progress}`],
                )}
              />
            </div>
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
  }
};
