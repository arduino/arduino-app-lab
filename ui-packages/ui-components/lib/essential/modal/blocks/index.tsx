// ----------------------------------------------------------------------
// IMPORTED FILE
//
// This code was imported from a external library to handle private
// dependencies required for the main application to run.
// ----------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  IconNavigationArrowLeft,
  IconNavigationCloseNormal,
} from '@arduino/react-icons';
import * as Dialog from '@radix-ui/react-dialog';
import { Slot, SlotProps } from '@radix-ui/react-slot';
import clsx from 'clsx';
import {
  type ComponentProps,
  forwardRef,
  ForwardRefExoticComponent,
  ReactNode,
  RefAttributes,
} from 'react';

import { NestedSlottable } from '../../../common/utils/nestedSlottable';
import { Small, XSmall } from '../../../typography';
import { IconButton } from '../../icon-button';
import { Scrollable } from '../../scrollable';
import { ModalContext, useModalContext } from './context';
import styles from './index.module.scss';

/*
 * ! OPEN ISSUES
 * - https://github.com/radix-ui/primitives/issues/2055
 */

export type ModalRootProps = ComponentProps<typeof Dialog.Root> & {
  /**
   * Trigger element (must be button)
   */
  trigger?: ReactNode;
  /**
   * Props to pass to the content element
   */
  contentProps?: Omit<ComponentProps<typeof Dialog.Content>, 'children'>;
  /**
   * If false, the modal won't close when clicking the overlay or the close button.
   * @default true
   */
  closeable?: boolean;
};

export const BaseModal = forwardRef<HTMLDivElement, ModalRootProps>(
  function BaseModal(props, ref) {
    const { trigger, contentProps, closeable = true, ...rest } = props;
    const {
      className: contentClassName,
      // Handle tabIndex manually
      tabIndex = 0,
      ...contentPropsRest
    } = contentProps ?? {};

    return (
      <ModalContext.Provider value={{ closeable }}>
        <Dialog.Root {...rest}>
          {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
          <Dialog.Portal>
            {/* This wrapper-div keeps us from needing transformations to handle portaling by keeping overlay and content as siblings and blocks propagation */}
            <Dialog.Overlay className={styles['Modal--overlay']} />
            <Dialog.Content
              ref={ref}
              tabIndex={tabIndex}
              className={clsx(styles.Modal, contentClassName)}
              {...(!closeable
                ? {
                    onEscapeKeyDown: (e): void => e.preventDefault(),
                    onPointerDownOutside: (e): void => e.preventDefault(),
                    onInteractOutside: (e): void => e.preventDefault(),
                  }
                : null)}
              {...contentPropsRest}
            >
              {props.children}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </ModalContext.Provider>
    );
  },
);

export type ModalHeaderProps = {
  /**
   * Title of the modal
   */
  title: string;
  /**
   * Shows a back button in the header
   */
  onBack?: () => void;
};

export function ModalHeader({ onBack, title }: ModalHeaderProps): JSX.Element {
  const { closeable } = useModalContext();
  return (
    <div className={styles.ModalHeader}>
      <div className={styles['ModalHeader--icon']}>
        {onBack ? (
          <button
            className={styles['ModalHeader--back']}
            onClick={(): void => onBack()}
          >
            <IconNavigationArrowLeft />
          </button>
        ) : null}
      </div>
      <Dialog.Title asChild>
        <Small>{title}</Small>
      </Dialog.Title>
      <div className={styles['ModalHeader--icon']}>
        {closeable ? <ModalCloseButton /> : null}
      </div>
    </div>
  );
}

export type ModalCoverProps = {
  /**
   * Cover image of the modal. Requires a valid url to an image
   */
  cover?: string | ReactNode;
};

export function ModalCover({ cover }: ModalCoverProps): JSX.Element {
  return (
    <div className={styles['ModalContent--cover']}>
      {typeof cover === 'string' ? <img src={cover} alt="" /> : cover}
    </div>
  );
}

export type ModalContentProps = ComponentProps<'div'>;

export function ModalContent(props: ModalContentProps): JSX.Element {
  const { children, className, ...rest } = props;

  return (
    <div className={clsx(styles.ModalContent, className)} {...rest}>
      {children}
    </div>
  );
}

export function ModalBody({
  children,
  className,
  asChild,
  ...rest
}: ComponentProps<'div'> & { asChild?: boolean }): JSX.Element {
  const Comp:
    | 'div'
    | ForwardRefExoticComponent<SlotProps & RefAttributes<HTMLElement> & any> =
    asChild ? Slot : 'div';

  return (
    <Scrollable className={styles.ModalBody} maxHeight="auto">
      <Comp className={clsx(styles['ModalBody--inner'], className)} {...rest}>
        {children}
      </Comp>
    </Scrollable>
  );
}

export function ModalFooter({
  children,
  className,
  asChild,
  ...rest
}: ComponentProps<'div'> & { asChild?: boolean }): JSX.Element {
  const Comp:
    | 'div'
    | ForwardRefExoticComponent<SlotProps & RefAttributes<HTMLElement> & any> =
    asChild ? Slot : 'div';

  return (
    <Comp
      className={clsx(styles['ModalContent--actions'], className)}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function ModalWarning({
  children,
  className,
  asChild = false,
  onClose,
  ...rest
}: ComponentProps<'div'> & {
  asChild?: boolean;
  onClose?: () => void;
}): JSX.Element {
  const Comp:
    | 'div'
    | ForwardRefExoticComponent<SlotProps & RefAttributes<HTMLElement> & any> =
    asChild ? Slot : 'div';

  return (
    <div className={styles.ModalWarning}>
      <Comp
        className={clsx(styles['ModalWarning--inner'], className)}
        {...rest}
      >
        <NestedSlottable asChild={asChild} child={children}>
          {(child): ReactNode => (
            <>
              <XSmall className={styles['ModalWarning--text']}>{child}</XSmall>
              {onClose ? (
                <button
                  className={styles['ModalWarning--close']}
                  onClick={onClose}
                >
                  <IconNavigationCloseNormal />
                </button>
              ) : (
                <button
                  className={styles['ModalWarning--close']}
                  onClick={onClose}
                >
                  <IconNavigationCloseNormal />
                </button>
              )}
            </>
          )}
        </NestedSlottable>
      </Comp>
    </div>
  );
}

export function ModalCloseButton({
  className,
  ...rest
}: Omit<
  ComponentProps<typeof Dialog.Close>,
  'children' | 'asChild'
>): JSX.Element {
  return (
    <Dialog.Close className={clsx(className)} asChild {...rest}>
      <IconButton label="X" Icon={IconNavigationCloseNormal} />
    </Dialog.Close>
  );
}

export const ModalClose = Dialog.Close;
