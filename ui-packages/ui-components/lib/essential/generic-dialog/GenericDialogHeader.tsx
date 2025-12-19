import DialogHeader, { DialogHeaderProps } from '../dialog-header/DialogHeader';
import styles from './generic-dialog.module.scss';

export type GenericDialogHeaderProps =
  | {
      children: JSX.Element;
    }
  | (DialogHeaderProps & { children?: undefined });

export const GenericDialogHeader = (
  props: GenericDialogHeaderProps,
): JSX.Element | null => {
  if (props.children) {
    return <div className={styles.header}>{props.children}</div>;
  }

  if (!props.children) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children: _, ...headerProps } = props;

    return (
      <DialogHeader
        {...headerProps}
        classes={{
          closeButton: styles['close-button'],
          header: styles.header,
        }}
      />
    );
  }

  return null;
};
