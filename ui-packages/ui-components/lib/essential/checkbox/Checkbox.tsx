import { NotificationSuccessCheck } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useRef } from 'react';
import {
  AriaCheckboxProps,
  useCheckbox,
  useFocusRing,
  VisuallyHidden,
} from 'react-aria';
import { useToggleState } from 'react-stately';

import { XXSmall } from '../../typography';
import styles from './checkbox.module.scss';

type CheckboxProps = AriaCheckboxProps & {
  classes?: {
    input?: string;
    label?: string;
  };
};

const Checkbox: React.FC<CheckboxProps> = (props: CheckboxProps) => {
  const { children, classes } = props;
  const state = useToggleState(props);
  const ref = useRef(null);
  const { inputProps, isSelected, isDisabled } = useCheckbox(props, state, ref);
  const { isFocusVisible, focusProps } = useFocusRing();

  return (
    <label
      className={clsx(styles.label, classes?.label, {
        [styles['checked']]: isSelected,
        [styles['disabled']]: isDisabled,
      })}
    >
      <VisuallyHidden>
        <input {...inputProps} {...focusProps} ref={ref} />
      </VisuallyHidden>
      <div
        className={clsx(styles.input, classes?.input, {
          [styles['focus-visible']]: isFocusVisible,
        })}
      >
        <NotificationSuccessCheck className={styles.icon} aria-hidden="true" />
      </div>
      {typeof children === 'string' ? <XXSmall>{children}</XXSmall> : children}
    </label>
  );
};

Checkbox.displayName = 'Checkbox';

export default Checkbox;
