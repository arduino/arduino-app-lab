import { setCSSVariable } from '@cloud-editor-mono/common';
import clsx from 'clsx';
import { ReactNode } from 'react';

import { Dialog } from '../dialog';
import styles from './focused-popover.module.scss';

export interface FocusedPopoverProps {
  children?: ReactNode;
  dialogRef: React.RefObject<HTMLDivElement>;
  themeClass?: string;
  reactModalProps: ReactModal.Props;
  setIsOpen: (open: boolean) => void;
  top?: number;
  left?: number;
}

const FocusedPopover: React.FC<FocusedPopoverProps> = (
  props: FocusedPopoverProps,
) => {
  const {
    themeClass,
    dialogRef,
    children,
    reactModalProps,
    setIsOpen,
    top = 0,
    left = 0,
  } = props;

  setCSSVariable(styles.focusedPopoverTop, `${top}px`);
  setCSSVariable(styles.focusedPopoverLeft, `${left}px`);

  return (
    <Dialog
      ref={dialogRef}
      appDomElementId={'root'}
      reactModalProps={reactModalProps}
      setIsOpen={setIsOpen}
      classes={{
        portal: clsx(styles.container, themeClass),
        overlay: styles.overlay,
      }}
    >
      {children}
    </Dialog>
  );
};

export default FocusedPopover;
