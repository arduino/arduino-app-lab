/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import { EmptyFn } from '@cloud-editor-mono/common';
import {
  AccountViewFilled,
  AccountViewFilledCrossed,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { isNil } from 'lodash';
import {
  forwardRef,
  Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Text, TextSize } from '../../typography';
import { IconButton } from '../icon-button';
import { BasicInput, BasicInputProps } from './BasicInput';
import styles from './input.module.scss';
import { InputStyle } from './input.type';

export type InputProps = BasicInputProps & {
  small?: boolean;
  bold?: boolean;
  error?: Error;
  autoSelect?: boolean;
  hideErrorOnFocus?: boolean;
  label?: string;
  className?: string;
  before?: React.ReactNode;
  after?: React.ReactNode;
  children?: React.ReactNode;
  monospace?: boolean;
  resizeContent?: boolean;
  disabled?: boolean;
  sensitive?: boolean;
  multiline?: boolean;
  onFocus?: (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  inputStyle?: InputStyle;
  classes?: {
    input?: string;
    inputContainer?: string;
    inputError?: string;
    inputLabel?: string;
    inputTextArea?: string;
    focused?: string;
    disabled?: string;
    error?: string;
    inputEye?: string;
  };
  styles?: {
    inputError?: React.CSSProperties;
  };
};

// eslint-disable-next-line react/display-name
export const Input = forwardRef(
  (props: InputProps, ref: Ref<HTMLDivElement>) => {
    const [focus, setFocus] = useState<boolean>();
    const [sensitive, setSensitive] = useState<boolean>(
      Boolean(props.sensitive),
    );

    const inputRef = useRef<HTMLInputElement>(null);

    const {
      error,
      className,
      label,
      children,
      required,
      before = null,
      after = null,
      monospace = false,
      resizeContent = false,
      disabled = false,
      onChange = EmptyFn,
      onBlur = EmptyFn,
      onFocus = EmptyFn,
      value,
      sensitive: _sensitive,
      style,
      hideErrorOnFocus,
      small = false,
      bold = false,
      type = 'text',
      autoSelect,
      autoFocus,
      multiline,
      inputStyle = InputStyle.CloudEditor,
      classes,
      styles: _styles,
      ...other
    } = props;

    const resizeInputContent = useCallback(
      (v = '') => {
        if (resizeContent && inputRef.current) {
          inputRef.current.style.width =
            inputRef.current.style.minWidth = `calc(${v.length}ch + 5px)`;
        }
      },
      [resizeContent],
    );

    useEffect(() => resizeInputContent(value), [resizeInputContent, value]);

    useEffect(() => {
      if (autoFocus) {
        inputRef.current?.focus();
      }
      if (autoSelect) {
        inputRef.current?.select();
      }
    }, [autoFocus, autoSelect]);

    const onInputFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        onFocus(e);
        setFocus(true);
      },
      [onFocus],
    );

    const onClick = (e: React.MouseEvent<HTMLDivElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      inputRef.current?.focus();
      inputStyle !== InputStyle.AppLab && inputRef.current?.select();
    };

    const onInputBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        onBlur(e);
        setFocus(false);
      },
      [onBlur],
    );

    const onInputChange = useCallback(
      (newValue: string) => {
        onChange(newValue);
        resizeInputContent(value);
      },
      [onChange, resizeInputContent, value],
    );

    const showError = !!error && !(focus && hideErrorOnFocus);

    return (
      <div
        ref={ref}
        className={clsx(
          styles.input,
          classes?.input,
          {
            [styles['has-content']]:
              !(isNil(value) || value === '') || before || after,
            [styles.focused]: focus,
            [styles.disabled]: disabled,
            [styles['has-error']]: showError,
            [styles.small]: small,
            [styles.sensitive]: sensitive,
            [styles['app-lab']]: inputStyle === InputStyle.AppLab,
            [classes?.error ?? '']: showError,
          },
          className,
        )}
        onClick={onClick}
        style={style}
      >
        {label && (
          <span
            className={clsx(styles['input-label'], classes?.inputLabel, {
              [styles.small]: small,
              [styles.bold]: bold,
            })}
          >
            {' '}
            <span>{label}</span>
            {required && <span className={styles['required-mark']}>*</span>}
          </span>
        )}
        <div
          className={clsx(styles['input-container'], classes?.inputContainer, {
            [styles.focused]: focus,
            [styles['has-error']]: showError,
            [styles.small]: small,
          })}
        >
          {before && <span className={styles['input-before']}>{before}</span>}
          {multiline ? (
            <textarea
              value={value}
              onChange={(e): void => onInputChange(e.currentTarget.value)}
              onKeyDown={(e): void => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  props.onEnter?.();
                }
              }}
              onFocus={props.onFocus}
              className={clsx(
                classes?.inputTextArea,
                styles['text-area'],
                styles['monospace'],
              )}
              disabled={disabled}
              placeholder={props.placeholder}
            />
          ) : (
            <BasicInput
              ref={inputRef}
              value={value}
              onBlur={onInputBlur}
              onFocus={onInputFocus}
              onChange={onInputChange}
              className={clsx(styles['basic-input'], styles['input-content'], {
                [styles.monospace]: monospace,
              })}
              disabled={disabled}
              required={required}
              type={sensitive ? 'password' : type}
              {...other}
            />
          )}
          {after && <span className={styles['input-after']}>{after}</span>}
          {children}
          {props.sensitive && (
            <IconButton
              classes={{ button: styles['input-eye'] }}
              label={sensitive ? 'Show text' : 'Hide text'}
              title={sensitive ? 'Show text' : 'Hide text'}
              Icon={sensitive ? AccountViewFilled : AccountViewFilledCrossed}
              onPress={(): void => setSensitive((prev) => !prev)}
            ></IconButton>
          )}
        </div>
        {showError ? (
          <Text
            className={clsx([styles['input-error'], classes?.inputError])}
            size={TextSize.XXSmall}
            style={_styles?.inputError}
          >
            {error?.message}
          </Text>
        ) : null}
      </div>
    );
  },
);
