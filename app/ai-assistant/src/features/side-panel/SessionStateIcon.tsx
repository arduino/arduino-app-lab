import clsx from 'clsx';

import styles from './session-state-icon.module.scss';
import { SessionState } from './sessionState.type';

export interface SessionStateIconProps {
  state: SessionState;
}

export const SessionStateIcon = ({
  state,
}: SessionStateIconProps): JSX.Element => (
  <span className={styles['wrapper']}>
    {state === 'typing' ? (
      <span className={styles['typing']}>
        <span />
        <span />
        <span />
      </span>
    ) : (
      <span className={clsx(styles['dot'], styles[state])} />
    )}
  </span>
);
