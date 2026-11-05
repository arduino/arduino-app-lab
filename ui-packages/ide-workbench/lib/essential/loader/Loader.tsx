import clsx from 'clsx';
import { ReactElement } from 'react';

import { Loader as LoaderIcon } from '../../assets/icons';
import styles from './loader.module.scss';

type LoaderProps = {
  tiny?: boolean;
  className?: string;
};

export function Loader({ tiny = false, className }: LoaderProps): ReactElement {
  return (
    <div
      className={clsx(
        styles['loader'],
        {
          [styles.tiny]: tiny,
        },
        className,
      )}
    >
      <LoaderIcon />
    </div>
  );
}
