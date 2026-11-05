/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import { EmptyFn } from '@cloud-editor-mono/common';
import {
  AccountViewFilled,
  AccountViewFilledCrossed,
  Error as ErrorIcon,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { isNil } from 'lodash-es';
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
import { InputSize, InputStyle, InputSurface } from './input.type';

export type InputProps = BasicInputProps & {
  small?: boolean;
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
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onFocus?: (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  inputStyle?: InputStyle;
  // App Lab only; Cloud Editor uses `small`, which App Lab reads as `inputSize="small"`.
  inputSize?: InputSize;
  outlined?: boolean;
  surface?: InputSurface;
  // App Lab only: the error takes space in the layout under the field instead of overlapping
  // what follows it. The root ref still points to the field.
  errorBelow?: boolean;
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
  inputRef?: React.Ref<HTMLInputElement>;
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
      onClick: handleClick = EmptyFn,
      value,
      sensitive: _sensitive,
      style,
      hideErrorOnFocus,
      small = false,
      type = 'text',
      autoSelect,
      autoFocus,
      multiline,
      inputStyle = InputStyle.CloudEditor,
      inputSize,
      outlined = false,
      surface = 'baseline',
      errorBelow = false,
      classes,
      styles: _styles,
      inputRef: externalInputRef,
      ...other
    } = props;

    const isAppLab = inputStyle === InputStyle.AppLab;
    const appLabSize = inputSize ?? (small ? 'small' : 'medium');
    const cloudEditorSmall = small && !isAppLab;

    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current =
          node;

        if (typeof externalInputRef === 'function') {
          externalInputRef(node);
        } else if (externalInputRef) {
          (
            externalInputRef as React.MutableRefObject<HTMLInputElement | null>
          ).current = node;
        }
      },
      [externalInputRef],
    );

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
      !isAppLab && inputRef.current?.select();
      handleClick(e);
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
    const isErrorBelow = isAppLab && errorBelow;

    const errorMessage = showError ? (
      <Text
        className={clsx(
          isErrorBelow
            ? [
                styles['input-error-below'],
                {
                  [styles.filled]:
                    appLabSize === 'x-small' || appLabSize === 'small',
                },
              ]
            : styles['input-error'],
          classes?.inputError,
        )}
        size={isAppLab ? TextSize.XXXSmall : TextSize.XXSmall}
        semibold={isAppLab}
        style={_styles?.inputError}
      >
        {isAppLab && <ErrorIcon className={styles['error-icon']} />}
        {error?.message}
      </Text>
    ) : null;

    return (
      <>
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
              [styles.small]: cloudEditorSmall,
              [styles['has-label']]: !!label,
              [styles['has-trailing-icon']]:
                !!props.sensitive || (isAppLab && !!children),
              [styles['app-lab']]: isAppLab,
              [styles.outlined]: isAppLab && outlined,
              [styles['on-below-1']]:
                isAppLab && !outlined && surface === 'below-1',
              [styles[`size-${appLabSize}`] ?? '']:
                isAppLab && appLabSize !== 'medium',
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
                [styles.small]: cloudEditorSmall,
              })}
            >
              {' '}
              <span>{label}</span>
              {required && <span>*</span>}
            </span>
          )}
          <div
            className={clsx(
              styles['input-container'],
              classes?.inputContainer,
              {
                [styles.focused]: focus,
                [styles['has-error']]: showError,
                [styles.small]: cloudEditorSmall,
              },
            )}
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
                ref={setInputRef}
                value={value}
                onBlur={onInputBlur}
                onFocus={onInputFocus}
                onChange={onInputChange}
                className={clsx(
                  styles['basic-input'],
                  styles['input-content'],
                  {
                    [styles.monospace]: monospace,
                  },
                )}
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
          {!isErrorBelow && errorMessage}
        </div>
        {isErrorBelow && errorMessage}
      </>
    );
  },
);
