import clsx from 'clsx';
import { Key, memo, useRef } from 'react';
import { useButton, useMenuTrigger } from 'react-aria';
import { MessageDescriptor } from 'react-intl';
import { useMenuTriggerState } from 'react-stately';

import DropdownMenuPopover from '../../essential/dropdown-menu/DropdownMenuPopover';
import styles from '../dropdown-menu/dropdown-menu.module.scss';
import {
  FilterableListItemType,
  FilterableListType,
} from './filterableList.type';
import { FilterableListWrapper } from './FilterableListWrapper';

interface FilterableListButtonProps<T, L extends MessageDescriptor | string> {
  buttonChildren?: React.ReactNode;
  getSections: () => FilterableListType<T, L> | undefined;
  disabledKeys?: Key[];
  onAction?: (key: Key) => void;
  onOpen?: (isOpen: boolean) => void;
  label: string;
  classes?: {
    wrapper?: string;
    button?: string;
    listContainer?: string;
    item?: string;
    buttonOpen?: string;
    popover?: string;
  };
}

export function FilterableListButton<T, L extends MessageDescriptor | string>(
  props: FilterableListButtonProps<T, L>,
): JSX.Element {
  const {
    buttonChildren = null,
    getSections,
    onAction,
    onOpen,
    label,
    classes,
  } = props;

  const state = useMenuTriggerState({ onOpenChange: onOpen });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { menuProps, menuTriggerProps } = useMenuTrigger<
    FilterableListItemType<T, L>
  >({}, state, buttonRef);

  const { buttonProps } = useButton(menuTriggerProps, buttonRef);

  const sections = getSections() as FilterableListType<T, L>;

  return (
    <div
      className={clsx(styles['dropdown-menu-button-wrapper'], classes?.wrapper)}
    >
      <button
        {...buttonProps}
        ref={buttonRef}
        className={clsx(
          styles['dropdown-menu-button'],
          classes?.button,
          state.isOpen && [
            styles['dropdown-menu-button-open'],
            classes?.buttonOpen,
          ],
        )}
      >
        {buttonChildren}
      </button>
      {state.isOpen && (
        <DropdownMenuPopover
          triggerRef={buttonRef}
          state={state}
          classes={{
            dropdownMenuPopover: classes?.popover,
          }}
        >
          <FilterableListWrapper
            {...menuProps}
            onAction={onAction}
            searchRef={null}
            searchable={true}
            sections={sections}
            label={label}
            filterList={(): FilterableListItemType<T, L>[] => []}
            classes={{
              container: classes?.listContainer,
              item: classes?.item,
            }}
          ></FilterableListWrapper>
        </DropdownMenuPopover>
      )}
    </div>
  );
}

export default memo(FilterableListButton);
