import { CaretDown, Checkmark } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { MessageDescriptor } from 'react-intl';

import { DropdownMenuButton } from '../../../../essential/dropdown-menu';
import { DropdownMenuButtonProps } from '../../../../essential/dropdown-menu/DropdownMenuButton';
import { Input, InputStyle, InputSurface } from '../../../../essential/input';
import { useI18n } from '../../../../i18n/useI18n';
import styles from './select.module.scss';

type SelectProps<T, L extends MessageDescriptor | string> = Pick<
  DropdownMenuButtonProps<T, L>,
  'sections'
> & {
  id?: string;
  name?: string;
  // Overrides the label looked up from `selectedId`; required when the selection is not one of `sections`.
  displayValue?: string;
  selectedId?: T;
  label?: string;
  disabled?: boolean;
  outlined?: boolean;
  surface?: InputSurface;
  rounded?: boolean;
  error?: Error;
  onChange: NonNullable<DropdownMenuButtonProps<T, L>['onAction']>;
  onEnter?: () => void;

  classes?: {
    container?: string;
    disabled?: string;
    open?: string;
    input?: string;
    inputLabel?: string;
    dropdownMenu?: string;
    dropdownMenuButton?: string;
    dropdownMenuButtonWrapper?: string;
    dropdownMenuIcon?: string;
  };
};

export const Select = forwardRef(
  <T, L extends MessageDescriptor | string>(
    props: SelectProps<T, L>,
    ref: React.ForwardedRef<HTMLDivElement | null>,
  ) => {
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLDivElement | null>(null);
    const { formatMessage } = useI18n();

    useImperativeHandle(ref, () => inputRef.current!);

    useEffect(() => {
      if (!open) return;
      function handleClickOutside(event: MouseEvent): void {
        if (
          inputRef.current &&
          !inputRef.current.contains(event.target as Node)
        ) {
          setOpen(false);
        }
      }

      document.addEventListener('click', handleClickOutside);
      return (): void => {
        document.removeEventListener('click', handleClickOutside);
      };
    }, [open]);

    const {
      id,
      name,
      displayValue,
      selectedId,
      label,
      disabled,
      outlined,
      surface = 'baseline',
      rounded,
      error,
      onChange,
      onEnter,
      sections,
      classes,
    } = props;

    const toggleOpen = (): void => {
      if (!disabled) {
        setOpen((prev) => !prev);
      }
    };

    const selectedLabel = sections
      .flatMap((section) => section.items)
      .find((item) => item.id === selectedId)?.label;
    const value =
      displayValue ??
      (selectedLabel === undefined
        ? ''
        : typeof selectedLabel === 'string'
        ? selectedLabel
        : formatMessage(selectedLabel));

    const markedSections =
      selectedId === undefined
        ? sections
        : sections.map((section) => ({
            ...section,
            items: section.items.map((item) =>
              item.id === selectedId
                ? {
                    ...item,
                    itemClassName: clsx(
                      item.itemClassName,
                      styles['dropdown-menu-item--selected'],
                    ),
                    labelSuffix: (
                      <>
                        {item.labelSuffix}
                        <Checkmark aria-hidden="true" />
                      </>
                    ),
                  }
                : item,
            ),
          }));

    return (
      <div
        ref={inputRef}
        role="button"
        tabIndex={0}
        className={clsx(styles['container'], classes?.container, {
          [styles['disabled']]: disabled,
          [styles['open']]: open,
          [styles.outlined]: outlined,
          [styles['on-below-1']]: !outlined && surface === 'below-1',
          [styles.rounded]: rounded,
          [styles['has-error']]: !!error,
          [classes?.disabled || '']: disabled,
          [classes?.open || '']: open,
        })}
        onClick={toggleOpen}
        onKeyUp={toggleOpen}
      >
        <Input
          inputStyle={InputStyle.AppLab}
          id={id}
          type="text"
          readOnly
          name={name}
          value={value}
          onClick={toggleOpen}
          onChange={onChange}
          onEnter={onEnter}
          label={label}
          error={error}
          classes={{
            input: clsx(styles['input'], classes?.input),
            inputLabel: clsx(styles['input-label'], classes?.inputLabel),
          }}
        />
        <DropdownMenuButton
          isOpen={open && !disabled}
          disabled={disabled}
          sections={markedSections}
          classes={{
            dropdownMenu: clsx(styles['dropdown-menu'], classes?.dropdownMenu),
            dropdownMenuButton: clsx(
              styles['dropdown-menu-button'],
              classes?.dropdownMenuButton,
            ),
            dropdownMenuButtonWrapper: clsx(
              styles['dropdown-menu-button-wrapper'],
              classes?.dropdownMenuButtonWrapper,
            ),
            dropdownMenuPopover: styles['dropdown-menu-popover'],
            dropdownMenuItem: styles['dropdown-menu-item'],
          }}
          useStaticPosition={false}
          onAction={(key): void => {
            setOpen(false);
            onChange(key);
          }}
          buttonChildren={
            <CaretDown
              className={clsx(
                styles['dropdown-menu-icon'],
                classes?.dropdownMenuIcon,
                {
                  [styles['dropdown-menu-icon--open']]: open,
                },
              )}
              onClick={toggleOpen}
            />
          }
        />
      </div>
    );
  },
);

Select.displayName = 'Select';
