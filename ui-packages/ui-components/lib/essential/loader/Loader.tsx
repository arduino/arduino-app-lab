import { Loader as LoaderIcon } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import styles from './loader.module.scss';

type LoaderProps = {
  tiny?: boolean;
  className?: string;
};

export function Loader({ tiny = false, className }: LoaderProps): JSX.Element {
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
