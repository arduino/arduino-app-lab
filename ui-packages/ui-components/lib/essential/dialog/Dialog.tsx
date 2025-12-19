import clsx from 'clsx';
import { ForwardedRef, forwardRef, useImperativeHandle, useRef } from 'react';
import ReactModal from 'react-modal';
import Modal from 'react-modal';

import styles from './dialog.module.scss';

Modal.defaultStyles.content = undefined;

export interface DialogProps {
  appDomElementId: string;
  reactModalProps: Modal.Props;
  setIsOpen: (value: boolean) => void;
  children?: React.ReactNode;
  classes?: {
    portal?: string;
    overlay?: string;
    content?: string;
  };
}

let dialogIsBound = false;

const Dialog = forwardRef(
  (props: DialogProps, ref: ForwardedRef<HTMLDivElement>) => {
    const { appDomElementId } = props;
    if (appDomElementId && !dialogIsBound) {
      dialogIsBound = true;
      Modal.setAppElement(`#${appDomElementId}`);
    }

    const { reactModalProps, setIsOpen, children, classes } = props;

    const modalRef = useRef<ReactModal>(null);

    const closeModal = (): void => {
      setIsOpen(false);
    };

    useImperativeHandle(ref, () => {
      return (modalRef.current?.portal?.content || null) as HTMLDivElement;
    });

    return (
      <Modal
        {...{
          onRequestClose: closeModal,
          portalClassName: classes?.portal,
          overlayClassName: clsx(styles.overlay, classes?.overlay),
          ref: modalRef,
          ...reactModalProps,
        }}
      >
        {children}
      </Modal>
    );
  },
);

Dialog.displayName = 'Dialog';

export default Dialog;
