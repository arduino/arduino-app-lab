import clsx from 'clsx';

import styles from './generic-dialog.module.scss';

export interface GenericDialogBodyProps {
  children: JSX.Element;
  classes?: {
    container?: string;
  };
}

export const GenericDialogBody: React.FC<GenericDialogBodyProps> = ({
  children,
  classes,
}: GenericDialogBodyProps): JSX.Element => (
  <div className={clsx(styles['dialog-body'], classes?.['container'])}>
    {children}
  </div>
);
