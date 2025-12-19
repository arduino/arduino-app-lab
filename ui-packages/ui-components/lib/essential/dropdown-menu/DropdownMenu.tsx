import clsx from 'clsx';
import { ReactElement, useRef } from 'react';
import { AriaMenuOptions, useMenu } from 'react-aria';
import { MessageDescriptor } from 'react-intl';
import { useTreeState } from 'react-stately';

import { DropdownMenuSection } from '.';
import styles from './dropdown-menu.module.scss';
import { DropdownMenuItemType } from './dropdownMenu.type';

interface DropdownMenuProps<T, L extends MessageDescriptor | string>
  extends AriaMenuOptions<DropdownMenuItemType<T, L>> {
  children: ReactElement | ReactElement[];
  classes?: {
    dropdownMenu?: string;
    dropdownMenuList?: string;
    dropdownMenuItem?: string;
  };
  useStaticPosition?: boolean;
}

export function DropdownMenu<T, L extends MessageDescriptor | string>(
  props: DropdownMenuProps<T, L>,
): JSX.Element {
  const { classes, useStaticPosition = true, ...rest } = props;

  const state = useTreeState<DropdownMenuItemType<T, L>>(rest);

  const ref = useRef<HTMLUListElement>(null);
  const { menuProps } = useMenu(rest, state, ref);

  return (
    <div
      className={clsx(
        styles['dropdown-menu'],
        useStaticPosition && styles['dropdown-menu-static'],
        classes?.dropdownMenu,
      )}
    >
      <ul
        {...menuProps}
        ref={ref}
        className={clsx(
          styles['dropdown-menu-list'],
          classes?.dropdownMenuList,
        )}
      >
        {[...state.collection].map((item) => (
          <DropdownMenuSection
            key={item.key}
            section={item}
            state={state}
            classes={{
              dropdownMenuItem: clsx(
                styles['dropdown-menu-item'],
                classes?.dropdownMenuItem,
              ),
            }}
          />
        ))}
      </ul>
    </div>
  );
}

export default DropdownMenu;
