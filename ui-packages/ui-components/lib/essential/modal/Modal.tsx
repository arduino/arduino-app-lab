// ----------------------------------------------------------------------
// IMPORTED FILE
//
// This code was imported from a external library to handle private
// dependencies required for the main application to run.
// ----------------------------------------------------------------------

import { type ComponentProps, forwardRef } from 'react';

import type {
  ModalContentProps,
  ModalCoverProps,
  ModalHeaderProps,
} from './blocks';
import {
  BaseModal,
  ModalBody,
  ModalContent,
  ModalCover,
  ModalFooter,
  ModalHeader,
  ModalWarning,
} from './blocks';

// ? How do we orchestrate this in a easy way? Probably this is fine, we can have more flexibility via composition (i.e extra `ModalContent`)
type ModalProps = ComponentProps<typeof BaseModal> &
  ModalContentProps &
  ModalHeaderProps &
  ModalCoverProps & {
    asChild?: boolean;
    warning?: {
      text: React.ReactNode;
      onClose?: () => void;
    };
    footer?: React.ReactNode;
  };

export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  {
    trigger,
    open,
    onOpenChange,
    modal,
    defaultOpen,
    children,
    contentProps,
    closeable,
    // Body props
    asChild,
    // Cover props
    cover,
    // Header props
    title,
    onBack,
    // Warning props
    warning,
    footer,
    // Content props
    ...rest
  }: ModalProps,
  ref,
) {
  // Conditionally build the header and cover sections
  const hasHeader = !!title || !!onBack;
  const hasCover = !!cover;

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
      trigger={trigger}
      modal={modal}
      closeable={closeable}
      contentProps={contentProps}
      ref={ref}
    >
      <ModalContent {...rest}>
        {warning ? (
          <ModalWarning onClose={warning.onClose}>{warning.text}</ModalWarning>
        ) : null}
        {hasHeader ? <ModalHeader title={title} onBack={onBack} /> : null}
        {hasCover ? <ModalCover cover={cover} /> : null}
        <ModalBody asChild={asChild}>{children}</ModalBody>
        {footer ? <ModalFooter>{footer}</ModalFooter> : null}
      </ModalContent>
    </BaseModal>
  );
});
