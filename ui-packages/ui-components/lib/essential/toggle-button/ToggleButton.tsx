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
  const { buttonOn, buttonOff, classes, isDisabled } = props;
  const ref = useRef<HTMLButtonElement>(null);
  const state = useToggleState(props);
  const { buttonProps } = useToggleButton(props, state, ref);

  return (
    <button
      {...buttonProps}
      className={clsx(
        styles['button'],
        { [styles['isSelected']]: state.isSelected },
        { [styles['isDisabled']]: isDisabled },
        classes?.button,
      )}
      ref={ref}
    >
      {buttonOn || buttonOff ? (
        state.isSelected ? (
          buttonOn ?? <ToggleOn />
        ) : (
          buttonOff ?? <ToggleOff />
        )
      ) : (
        <div className={styles['track']}>
          <div className={styles['thumb']} />
        </div>
      )}
    </button>
  );
};
export default ToggleButton;
