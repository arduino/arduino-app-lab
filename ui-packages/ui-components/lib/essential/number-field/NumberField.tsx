import clsx from 'clsx';
import { useRef } from 'react';
import { AriaNumberFieldProps, useLocale, useNumberField } from 'react-aria';
import { useNumberFieldState } from 'react-stately';

import { IconButton } from '../icon-button';
import styles from './number-field.module.scss';

interface NumberFieldProps extends AriaNumberFieldProps {
  label: string;
  unit?: string;
  DecIcon: React.FC;
  IncIcon: React.FC;
  classes?: {
    container?: string;
    button?: string;
    input?: string;
  };
}

const NumberField: React.FC<NumberFieldProps> = (props: NumberFieldProps) => {
  const { label, unit, DecIcon, IncIcon, classes } = props;
  const { locale } = useLocale();
  const state = useNumberFieldState({ ...props, locale });

  const inputRef = useRef(null);

  const { groupProps, inputProps, incrementButtonProps, decrementButtonProps } =
    useNumberField(props, state, inputRef);

  return (
    <div {...groupProps} aria-label={label} className={classes?.container}>
      <IconButton
        label={'Inc'}
        Icon={DecIcon}
        {...decrementButtonProps}
        classes={{ button: clsx(classes?.button, styles['button']) }}
      />
      <input
        {...inputProps}
        ref={inputRef}
        className={classes?.input}
        value={`${state.inputValue} ${unit}`}
      />
      <IconButton
        label={'Dec'}
        Icon={IncIcon}
        {...incrementButtonProps}
        classes={{ button: clsx(classes?.button, styles['button']) }}
      />
    </div>
  );
};

export default NumberField;
