import { EmptyFn } from '@cloud-editor-mono/common';
import React, {
  ForwardedRef,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';

import { InputValidateBehavior } from './input.type';

type DefaultProps = Omit<
  React.DetailedHTMLProps<
    React.InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
  >,
  'onChange' | 'ref'
>;

export type BasicInputProps = DefaultProps & {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  blurOnEnter?: boolean;
  validateBehavior?: InputValidateBehavior;
  validate?: (value: string) => boolean;
  onInputFail?: (value: string) => void;
};

export const BasicInput = forwardRef(
  (props: BasicInputProps, ref: ForwardedRef<HTMLInputElement>) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const {
      value,
      validateBehavior = InputValidateBehavior.OnChange,
      blurOnEnter = true,
      onBlur = EmptyFn,
      onKeyDown = EmptyFn,
      onInputFail = EmptyFn,
      onChange = EmptyFn,
      onEnter = EmptyFn,
      validate = (): boolean => true,
      ...others
    } = props;

    useImperativeHandle(ref, () => inputRef.current!);

    const onInputBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
      onBlur(e);

      if (validateBehavior === InputValidateBehavior.OnBlur) {
        propagate(e.currentTarget.value);
      }
    };

    const onInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>,
    ): void => {
      onKeyDown(event);

      if (event.key === 'Enter') {
        if (blurOnEnter) {
          inputRef.current?.blur();
        }
        onEnter();
      }
    };

    const onInputChange = ({
      currentTarget,
    }: React.FormEvent<HTMLInputElement>): void => {
      if (validateBehavior === InputValidateBehavior.OnChange) {
        propagate(currentTarget.value);
      }
    };

    const propagate = (v: string): void => {
      if (validate(v)) {
        return onChange(v);
      }

      onInputFail(v);
    };

    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onBlur={onInputBlur}
        onKeyDown={onInputKeyDown}
        onChange={onInputChange}
        {...others}
      />
    );
  },
);

BasicInput.displayName = 'BasicInput';
