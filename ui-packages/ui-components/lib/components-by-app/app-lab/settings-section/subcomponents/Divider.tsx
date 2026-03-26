import clsx from 'clsx';

import styles from '../settings-section.module.scss';

export interface DividerProps {
  space?: number;
  className?: string;
}

export const Divider = ({ space, className }: DividerProps): JSX.Element => {
  return (
    <hr
      className={clsx(styles['settings-section-divider'], className)}
      style={{
        marginTop: space,
        marginBottom: space,
      }}
    />
  );
};
