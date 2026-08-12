import { ArduinoLoader as ArduinoLoaderIcon } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import styles from './arduino-loader.module.scss';

export function ArduinoLoader({
  secondary,
  className,
}: {
  secondary?: boolean;
  className?: string;
}): JSX.Element {
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
