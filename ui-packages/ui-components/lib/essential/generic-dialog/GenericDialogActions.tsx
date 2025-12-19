import clsx from 'clsx';

import styles from './generic-dialog.module.scss';

export interface GenericDialogActionsProps {
  children: JSX.Element;
  classes?: {
    container?: string;
  };
}

export const GenericDialogActions: React.FC<GenericDialogActionsProps> = ({
  children,
  classes,
}: GenericDialogActionsProps): JSX.Element => (
  <div className={clsx(styles['dialog-actions'], classes?.container)}>
    {children}
  </div>
);
