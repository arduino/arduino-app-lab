import { CloseX as CloseXIcon } from '@cloud-editor-mono/images/assets/icons';
import { Close, DialogTitle } from '@radix-ui/react-dialog';
import clsx from 'clsx';
import { ComponentProps, ForwardedRef, forwardRef } from 'react';

import {
  BaseModal,
  ModalBody,
  ModalContent,
  ModalFooter,
} from '../../../essential/modal';
import styles from './app-lab-dialog.module.scss';

type AppLabDialogStyles = {
  root?: string;
  content?: string;
  header?: string;
  body?: string;
  footer?: string;
  closeButton?: string;
};

type AppLabDialogProps = ComponentProps<typeof BaseModal> & {
  title?: string | React.ReactNode;
  asChild?: boolean;
  classes?: AppLabDialogStyles;
  footer?: React.ReactNode;
  onSubmit?: () => unknown;
};

export const AppLabDialog = forwardRef(
  (props: AppLabDialogProps, ref: ForwardedRef<HTMLDivElement>) => {
    const {
      open,
      onOpenChange,
      defaultOpen,
      trigger,
      modal = true,
      closeable = true,
      contentProps,
      children,
      classes = {},
      title,
      asChild = false,
      footer,
      onSubmit,
      ...rest
    } = props;

    return (
      <BaseModal
        open={open}
        onOpenChange={onOpenChange}
        defaultOpen={defaultOpen}
        trigger={trigger}
        modal={modal}
        closeable={closeable}
        contentProps={{
          ...contentProps,
          'aria-describedby': typeof title === 'string' ? title : undefined,
          className: clsx(styles['app-lab-dialog'], classes.root),
          // tabIndex={-1 as number}
        }}
        ref={ref}
      >
        <ModalContent
          {...rest}
          className={clsx(styles['app-lab-dialog-content'], classes.content)}
        >
          <form
            onSubmit={(e): void => {
              e.preventDefault();
              onSubmit?.();
            }}
            style={{ display: 'contents' }}
          >
            <button type="submit" style={{ display: 'none' }}>
              Submit
            </button>
            {title ? (
              <div
                className={clsx(
                  styles['app-lab-dialog-header'],
                  classes.header,
                )}
              >
                <DialogTitle>{title}</DialogTitle>
                {closeable ? (
                  <Close
                    className={clsx(
                      styles['app-lab-dialog-header-close'],
                      classes.closeButton,
                    )}
                  >
                    <CloseXIcon />
                  </Close>
                ) : null}
              </div>
            ) : null}
            <ModalBody
              className={clsx(styles['app-lab-dialog-body'], classes.body)}
              asChild={asChild}
            >
              {children}
            </ModalBody>
            {footer ? (
              <ModalFooter
                className={clsx(
                  styles['app-lab-dialog-footer'],
                  classes.footer,
                )}
              >
                {footer}
              </ModalFooter>
            ) : null}
          </form>
        </ModalContent>
      </BaseModal>
    );
  },
);

AppLabDialog.displayName = 'AppLabDialog';
