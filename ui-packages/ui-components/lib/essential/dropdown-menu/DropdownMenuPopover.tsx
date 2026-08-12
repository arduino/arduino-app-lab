import { AriaPopoverProps, Overlay, usePopover } from '@react-aria/overlays';
import clsx from 'clsx';
import { useRef } from 'react';
import { useInteractOutside } from 'react-aria';
import { MenuTriggerState } from 'react-stately';

import styles from './dropdown-menu.module.scss';

interface DropdownMenuPopoverProps
  extends Omit<AriaPopoverProps, 'popoverRef'> {
  children: React.ReactNode;
  state: MenuTriggerState;
  classes?: { dropdownMenuPopover?: string };
  useStaticPosition?: boolean;
  /**
   * Render the popover in a portal attached to the document body. Needed when
   * an ancestor clips (`overflow`) or caps (`z-index`) the popover, e.g. inside
   * a resizable panel. Requires `useStaticPosition={false}` to be positioned.
   */
  usePortal?: boolean;
}

const DropdownMenuPopover: React.FC<DropdownMenuPopoverProps> = (
  props: DropdownMenuPopoverProps,
) => {
  const {
    children,
    state,
    classes,
    useStaticPosition = true,
    usePortal = false,
  } = props;

  const ref = useRef<HTMLDivElement>(null);

  const { popoverProps } = usePopover(
    {
      ...props,
      popoverRef: ref,
      isNonModal: true,
      ...(!useStaticPosition && {
        offset: 8,
        placement: 'bottom left',
      }),
    },
    state,
  );

  useInteractOutside({
    ref,
    onInteractOutside: () => {
      state.close();
    },
  });

  const popover = (
    <div
      {...popoverProps}
      style={popoverProps.style}
      ref={ref}
      className={clsx(
        useStaticPosition && styles['dropdown-menu-popover-static'],
        usePortal && styles['dropdown-menu-popover-portal'],
        classes?.dropdownMenuPopover,
      )}
    >
      {children}
    </div>
  );

  return usePortal ? <Overlay>{popover}</Overlay> : popover;
};

export default DropdownMenuPopover;
