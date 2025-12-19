import clsx from 'clsx';
import { useContext, useRef } from 'react';
import { AriaRadioProps, useRadio } from 'react-aria';

import styles from '../radio-group.module.scss';
import { RadioContext } from '../RadioGroup';
interface RadioProps extends AriaRadioProps {
  label?: string;
  classes?: {
    container?: string;
    input?: string;
  };
}

const Radio: React.FC<RadioProps> = (props: RadioProps) => {
  const { label, classes, children } = props;
  const state = useContext(RadioContext);
  const ref = useRef(null);
  const { inputProps } = useRadio(props, state, ref);

  return (
    <label className={classes?.container}>
      <input
        {...inputProps}
        ref={ref}
        value={label}
        className={clsx(styles.input, classes?.input)}
      />
      {children}
    </label>
  );
};

export default Radio;
