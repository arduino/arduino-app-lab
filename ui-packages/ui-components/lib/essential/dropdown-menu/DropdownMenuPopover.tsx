import { AriaPopoverProps, usePopover } from '@react-aria/overlays';
import clsx from 'clsx';
import { useRef } from 'react';
import { MenuTriggerState } from 'react-stately';

import styles from './dropdown-menu.module.scss';

interface DropdownMenuPopoverProps
  extends Omit<AriaPopoverProps, 'popoverRef'> {
  children: React.ReactNode;
  state: MenuTriggerState;
  classes?: { dropdownMenuPopover?: string };
  useStaticPosition?: boolean;
}

const DropdownMenuPopover: React.FC<DropdownMenuPopoverProps> = (
  props: DropdownMenuPopoverProps,
) => {
  const { children, state, classes, useStaticPosition = true } = props;

  const ref = useRef<HTMLDivElement>(null);
  const { popoverProps } = usePopover(
    {
      ...props,
      popoverRef: ref,
      ...(!useStaticPosition && {
        offset: 8,
        placement: 'bottom left',
      }),
    },
    state,
  );

  return (
    <div
      {...popoverProps}
      style={popoverProps.style}
      ref={ref}
      className={clsx(
        useStaticPosition && styles['dropdown-menu-popover-static'],
        classes?.dropdownMenuPopover,
      )}
    >
      {children}
    </div>
  );
};

export default DropdownMenuPopover;
