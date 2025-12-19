import type { Node } from '@react-types/shared';
import clsx from 'clsx';
import { useRef } from 'react';
import { mergeProps, useFocusRing, useMenuItem } from 'react-aria';
import { MessageDescriptor } from 'react-intl';
import { TreeState } from 'react-stately';

import styles from './dropdown-menu.module.scss';
import { DropdownMenuItemType } from './dropdownMenu.type';

interface DropdownMenuItemProps<T, L extends MessageDescriptor | string> {
  item: Node<DropdownMenuItemType<T, L>>;
  state: TreeState<DropdownMenuItemType<T, L>>;
  classes?: { dropdownMenuItem?: string; dropdownMenuItemDisabled?: string };
}

function DropdownMenuItem<T, L extends MessageDescriptor | string>(
  props: React.PropsWithChildren<DropdownMenuItemProps<T, L>>,
): JSX.Element {
  const { item, state, classes } = props;

  const ref = useRef<HTMLLIElement>(null);
  const { menuItemProps, isDisabled } = useMenuItem(
    { key: item.key },
    state,
    ref,
  );

  const { isFocusVisible, focusProps } = useFocusRing();

  return (
    <li {...mergeProps(focusProps, menuItemProps)} ref={ref}>
      <button
        className={clsx(
          styles['dropdown-menu-item'],
          classes?.dropdownMenuItem,
          isDisabled && [
            styles['dropdown-menu-item-disabled'],
            classes?.dropdownMenuItemDisabled,
          ],
          item.value?.itemClassName,
          isFocusVisible && [styles['dropdown-menu-item-focused']],
        )}
      >
        {item.rendered}
      </button>
    </li>
  );
}

export default DropdownMenuItem;
