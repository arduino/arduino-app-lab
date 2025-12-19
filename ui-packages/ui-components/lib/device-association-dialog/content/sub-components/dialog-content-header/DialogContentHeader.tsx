import clsx from 'clsx';
import { ReactNode } from 'react';

import { Medium, XXSmall } from '../../../../typography';
import styles from './dialog-content-header.module.scss';

interface DialogContentHeaderProps {
  title?: string;
  subtitle?: string | ReactNode;
  classes?: {
    container?: string;
    header?: string;
    title?: string;
    subtitle?: string;
  };
}

const DialogContentHeader: React.FC<DialogContentHeaderProps> = (
  props: DialogContentHeaderProps,
) => {
  const { title, subtitle, classes } = props;

  return (
    <div className={clsx(styles.container, classes?.container)}>
      {title || subtitle ? (
        <header className={clsx(styles.header, classes?.header)}>
          {title ? (
            <Medium bold className={clsx(styles.title, classes?.title)}>
              {title}
            </Medium>
          ) : null}
          {subtitle ? (
            <XXSmall className={clsx(styles.subtitle, classes?.subtitle)}>
              {subtitle}
            </XXSmall>
          ) : null}
        </header>
      ) : null}
    </div>
  );
};

export default DialogContentHeader;
