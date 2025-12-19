import { setCSSVariable } from '@cloud-editor-mono/common';
import clsx from 'clsx';
import { Key, memo, ReactElement, useLayoutEffect, useRef } from 'react';
import { useButton, useMenuTrigger } from 'react-aria';
import { MessageDescriptor } from 'react-intl';
import { Item, Section, useMenuTriggerState } from 'react-stately';
import { useWindowSize } from 'react-use';

import DropdownMenu from '../../essential/dropdown-menu/DropdownMenu';
import DropdownMenuPopover from '../../essential/dropdown-menu/DropdownMenuPopover';
import { useI18n } from '../../i18n/useI18n';
import { XXSmall } from '../../typography';
import styles from './dropdown-menu.module.scss';
import styleVars from './dropdown-menu-variables.module.scss';
import {
  DropdownMenuItemType,
  DropdownMenuSectionType,
} from './dropdownMenu.type';

interface DropdownMenuButtonProps<T, L extends MessageDescriptor | string> {
  id?: string;
  title?: string;
  buttonChildren?: React.ReactNode;
  sections: DropdownMenuSectionType<T, L>[];
  disabledKeys?: Key[];
  onAction?: (key: Key) => void;
  isOpen?: boolean;
  onOpen?: (isOpen: boolean) => void;
  isOpened?: boolean;
  classes?: {
    dropdownMenuButtonWrapper?: string;
    dropdownMenuButton?: string;
    dropdownMenuButtonOpen?: string;
    dropdownMenuPopover?: string;
    dropdownMenu?: string;
    dropdownMenuList?: string;
    dropdownMenuItem?: string;
  };
  disabled?: boolean;
  useStaticPosition?: boolean;
}

export function DropdownMenuButton<T, L extends MessageDescriptor | string>(
  props: DropdownMenuButtonProps<T, L>,
): JSX.Element {
  const {
    id,
    title,
    buttonChildren = null,
    sections,
    disabledKeys,
    onAction,
    isOpen,
    onOpen,
    classes,
    useStaticPosition,
    isOpened,
    disabled,
  } = props;

  const { formatMessage } = useI18n();

  const state = useMenuTriggerState({ isOpen, onOpenChange: onOpen });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { menuProps, menuTriggerProps } = useMenuTrigger<
    DropdownMenuItemType<T, L>
  >({}, state, buttonRef);

  const { buttonProps } = useButton(
    { isDisabled: disabled, ...menuTriggerProps },
    buttonRef,
  );

  const { width: windowWidth } = useWindowSize();

  useLayoutEffect(() => {
    const buttonX = buttonRef.current?.getBoundingClientRect().x;
    if (state.isOpen && typeof buttonX === 'number') {
      const dropdownMenuWidth = Number(styleVars.dropdownMenuWidth);

      const dropdownMenuOrientation =
        windowWidth - buttonX > dropdownMenuWidth ? 0 : 1; // 0: right, 1: left
      setCSSVariable(
        styleVars.dropdownMenuOrientation,
        `${dropdownMenuOrientation}`,
      );
    }
  }, [state.isOpen, windowWidth]);

  return (
    <div
      id={id}
      title={title}
      className={clsx(
        styles['dropdown-menu-button-wrapper'],
        classes?.dropdownMenuButtonWrapper,
      )}
    >
      {!isOpened && (
        <button
          {...buttonProps}
          ref={buttonRef}
          className={clsx(
            styles['dropdown-menu-button'],
            classes?.dropdownMenuButton,
            state.isOpen && [
              styles['dropdown-menu-button-open'],
              classes?.dropdownMenuButtonOpen,
            ],
          )}
        >
          {buttonChildren}
        </button>
      )}
      {(state.isOpen || isOpened) && (
        <DropdownMenuPopover
          triggerRef={buttonRef}
          state={state}
          classes={{
            dropdownMenuPopover: classes?.dropdownMenuPopover,
          }}
          useStaticPosition={useStaticPosition}
        >
          <DropdownMenu
            {...menuProps}
            onAction={onAction}
            disabledKeys={disabledKeys}
            classes={{
              dropdownMenu: classes?.dropdownMenu,
              dropdownMenuList: classes?.dropdownMenuList,
              dropdownMenuItem: classes?.dropdownMenuItem,
            }}
            useStaticPosition={useStaticPosition}
            {...(isOpen !== undefined ? { onClose: () => ({}) } : {})}
          >
            {sections.map((section) => (
              <Section key={section.name} items={section.items}>
                {(item: DropdownMenuItemType<T, L>): ReactElement => {
                  const label =
                    typeof item.label === 'string'
                      ? item.label
                      : formatMessage(item.label);

                  return (
                    <Item textValue={label}>
                      <XXSmall>
                        {item.node || (
                          <>
                            {item.labelPrefix}
                            {label}
                            {item.labelSuffix}
                          </>
                        )}
                      </XXSmall>
                    </Item>
                  );
                }}
              </Section>
            ))}
          </DropdownMenu>
        </DropdownMenuPopover>
      )}
    </div>
  );
}

export default memo(DropdownMenuButton);
