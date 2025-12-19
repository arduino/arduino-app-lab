import clsx from 'clsx';

import { Dialog } from '../dialog';
import styles from './generic-dialog.module.scss';
import {
  type GenericDialogActionsProps,
  GenericDialogActions,
} from './GenericDialogActions';
import {
  type GenericDialogBodyProps,
  GenericDialogBody,
} from './GenericDialogBody';
import {
  type GenericDialogHeaderProps,
  GenericDialogHeader,
} from './GenericDialogHeader';

export interface GenericDialogProps {
  children?: JSX.Element;
  dialogRef?: React.RefObject<HTMLDivElement>;
  themeClass?: string;
  classes?: {
    container?: string;
    overlay?: string;
  };
  reactModalProps: ReactModal.Props;
  setIsOpen: (open: boolean) => void;
}

const GenericDialog: React.FC<GenericDialogProps> & {
  Header: React.FC<GenericDialogHeaderProps>;
  Body: React.FC<GenericDialogBodyProps>;
  Actions: React.FC<GenericDialogActionsProps>;
} = (props: GenericDialogProps) => {
  const {
    themeClass,
    classes,
    dialogRef,
    children,
    reactModalProps,
    setIsOpen,
  } = props;

  // const dialogRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog
      ref={dialogRef}
      appDomElementId={'root'}
      reactModalProps={reactModalProps}
      setIsOpen={setIsOpen}
      classes={{
        portal: clsx(styles.container, themeClass),
        overlay: clsx(styles.overlay, classes?.overlay),
      }}
    >
      <div className={clsx(styles.container, classes?.container)}>
        {children}
      </div>
    </Dialog>
  );
};

GenericDialog.Header = GenericDialogHeader;
GenericDialog.Body = GenericDialogBody;
GenericDialog.Actions = GenericDialogActions;

export default GenericDialog;
