import clsx from 'clsx';
import React from 'react';

import { XXSmall } from '../../../shared';
import styles from '../settings-section.module.scss';
import { Info } from './Info';

export interface RowProps {
  label?: React.ReactNode;
  info?: React.ReactNode;
  children: React.ReactNode;
  classes?: {
    wrapper?: string;
    label?: string;
    info?: string;
    value?: string;
  };
}

export const Row = ({
  label,
  info,
  children,
  classes,
}: RowProps): JSX.Element => {
  return (
    <div className={clsx(styles['settings-section-row'], classes?.wrapper)}>
      {label && (
        <div
          className={clsx(
            styles['settings-section-row--label'],
            classes?.label,
          )}
        >
          <XXSmall className={styles['label']}>{label}</XXSmall>
          {info && <Info className={classes?.info}>{info}</Info>}
        </div>
      )}
      <div
        className={clsx(styles['settings-section-row--value'], classes?.value)}
      >
        {children}
      </div>
    </div>
  );
};
