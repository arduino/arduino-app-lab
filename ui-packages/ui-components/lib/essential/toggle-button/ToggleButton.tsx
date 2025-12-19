import { ToggleOff, ToggleOn } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useRef } from 'react';
import { AriaToggleButtonProps, useToggleButton } from 'react-aria';
import { useToggleState } from 'react-stately';

import styles from './toggle-button.module.scss';

interface ToggleButtonProps extends AriaToggleButtonProps {
  buttonOn?: React.ReactNode;
  buttonOff?: React.ReactNode;
  classes?: {
    container?: string;
    button?: string;
    icon?: string;
  };
}

const ToggleButton: React.FC<ToggleButtonProps> = (
  props: ToggleButtonProps,
) => {
  const { buttonOn, buttonOff, classes } = props;
  const ref = useRef<HTMLButtonElement>(null);
  const state = useToggleState(props);
  const { buttonProps } = useToggleButton(props, state, ref);

  return (
    <button
      {...buttonProps}
      className={clsx(
        styles['button'],
        { [styles['isSelected']]: state.isSelected },
        classes?.button,
      )}
      ref={ref}
    >
      {state.isSelected ? buttonOn ?? <ToggleOn /> : buttonOff ?? <ToggleOff />}
    </button>
  );
};
export default ToggleButton;
