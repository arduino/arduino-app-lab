import { setCSSVariable } from '@cloud-editor-mono/common';
import clsx from 'clsx';
import { ReactElement, useCallback, useEffect, useRef } from 'react';
import {
  AriaButtonProps,
  AriaMenuOptions,
  useButton,
  useMenu,
  useMenuTrigger,
} from 'react-aria';
import {
  Item,
  MenuTriggerProps,
  Section,
  useMenuTriggerState,
  useTreeState,
} from 'react-stately';

import { XSmall } from '../../typography';
import DropdownMenuPopover from '../dropdown-menu/DropdownMenuPopover';
import DropdownMenuSection from '../dropdown-menu/DropdownMenuSection';
import styles from './dropdown-rounded.module.scss';

interface ButtonProps extends AriaButtonProps {
  children: React.ReactNode;
  className: string;
  buttonRef: React.RefObject<HTMLButtonElement>;
}
const Button: React.FC<ButtonProps> = (props: ButtonProps) => {
  const ref = props.buttonRef;
  const { buttonProps } = useButton(props, ref);
  return (
    <button {...buttonProps} ref={ref} className={props.className}>
      {props.children}
    </button>
  );
};

interface MenuProps extends AriaMenuOptions<any> {
  children: ReactElement | ReactElement[];
  itemsCount: number;
  classes?: string;
}

const Menu: React.FC<MenuProps> = (props: MenuProps) => {
  const state = useTreeState(props);

  const ref = useRef<HTMLUListElement>(null);
  const { menuProps } = useMenu(props, state, ref);

  useEffect(() => {
    setCSSVariable(
      styles.dropdownRoundedMenuTop,
      `${
        -1 * props.itemsCount * parseInt(styles.dropdownRoundedItemHeight) - 42
      }px`,
    );
  }, [props.itemsCount]);

  return (
    <div className={clsx(styles['dropdown-rounded-menu'], props.classes)}>
      <ul {...menuProps} ref={ref}>
        {[...state.collection].map((item) => (
          <DropdownMenuSection key={item.key} section={item} state={state} />
        ))}
      </ul>
    </div>
  );
};

const DefaultButtonContent: React.FC<React.PropsWithChildren> = ({
  children,
}: React.PropsWithChildren) => <>{children}</>;

interface DropdownRoundedProps<T extends string, V extends string | number>
  extends MenuTriggerProps {
  items: { text: T; value: V }[];
  selectedValue: V;
  onChange: (value: V) => void;
  disabled?: boolean;
  ButtonContent?: React.FC<React.PropsWithChildren>;
  classes?: { wrapper?: string; menu?: string };
}

const DropdownRounded = <T extends string, V extends string | number>(
  props: DropdownRoundedProps<T, V>,
): JSX.Element => {
  const {
    items,
    selectedValue,
    onChange,
    disabled = false,
    ButtonContent = DefaultButtonContent,
    classes,
  } = props;
  const state = useMenuTriggerState(props);

  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { menuTriggerProps, menuProps } = useMenuTrigger<number>(
    {},
    state,
    buttonRef,
  );

  const handleAction = useCallback(
    (value: string | number) => {
      const selectedItem = items.find(
        (item) => item.value.toString() === value,
      );
      if (!selectedItem) {
        throw new Error(`Invalid value: ${value}`);
      }
      onChange(selectedItem.value);
    },
    [items, onChange],
  );

  return (
    <div className={clsx(styles['dropdown-rounded-wrapper'], classes?.wrapper)}>
      <Button
        {...menuTriggerProps}
        buttonRef={buttonRef}
        className={clsx(
          styles['dropdown-rounded-button'],
          state.isOpen
            ? styles['dropdown-rounded-button-open']
            : styles['dropdown-rounded-button-closed'],
          disabled && styles['dropdown-rounded-button-disabled'],
        )}
      >
        <XSmall>
          <ButtonContent>
            {items.find((item) => item.value === selectedValue)?.text}
          </ButtonContent>
        </XSmall>
      </Button>
      {state.isOpen && (
        <DropdownMenuPopover triggerRef={popoverRef} state={state}>
          <Menu
            {...menuProps}
            {...props}
            itemsCount={items.length}
            onAction={handleAction}
            classes={classes?.menu}
          >
            <Section<{ text: T; value: V }> items={items}>
              {(item): ReactElement => {
                return (
                  <Item key={item.value} textValue={item.text}>
                    {item.value === selectedValue ? (
                      <span
                        className={styles['dropdown-rounded-item-selected']}
                      >
                        {item.text}
                      </span>
                    ) : (
                      item.text
                    )}
                  </Item>
                );
              }}
            </Section>
          </Menu>
        </DropdownMenuPopover>
      )}
    </div>
  );
};

export default DropdownRounded;
