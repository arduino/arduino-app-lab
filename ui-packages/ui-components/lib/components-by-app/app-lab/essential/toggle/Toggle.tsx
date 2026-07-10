import {
  AppLabToggleOff,
  AppLabToggleOn,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useRef } from 'react';
import { AriaToggleButtonProps, useToggleButton } from 'react-aria';
import { useToggleState } from 'react-stately';

import styles from './toggle.module.scss';

interface ToggleProps extends AriaToggleButtonProps {
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = (props: ToggleProps) => {
  const { className, isDisabled } = props;
  const ref = useRef<HTMLButtonElement>(null);
  const state = useToggleState(props);
  const { buttonProps } = useToggleButton(props, state, ref);

  return (
    <button
      {...buttonProps}
      className={clsx(
        styles['button'],
        { [styles['disabled']]: isDisabled },
        className,
      )}
      ref={ref}
    >
      {state.isSelected ? <AppLabToggleOn /> : <AppLabToggleOff />}
    </button>
  );
};

Toggle.displayName = 'Toggle';
