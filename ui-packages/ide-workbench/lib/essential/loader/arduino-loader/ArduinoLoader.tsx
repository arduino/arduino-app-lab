import clsx from 'clsx';
import { ReactElement } from 'react';

import { ArduinoLoader as ArduinoLoaderIcon } from '../../../assets/icons';
import styles from './arduino-loader.module.scss';

export function ArduinoLoader({
  secondary,
  className,
}: {
  secondary?: boolean;
  className?: string;
}): ReactElement {
  return (
    <div
      className={clsx(
        styles['arduino-loader'],
        {
          [styles.secondary]: secondary,
        },
        className,
      )}
    >
      <ArduinoLoaderIcon />
    </div>
  );
}
