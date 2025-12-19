import { createContext } from 'react';
import { AriaRadioGroupProps, useRadioGroup } from 'react-aria';
import { RadioGroupState, useRadioGroupState } from 'react-stately';

const radioGroupState: RadioGroupState = {} as RadioGroupState;

export const RadioContext = createContext<RadioGroupState>(radioGroupState);

interface RadioGroupProps extends AriaRadioGroupProps {
  label: string;
  children: React.ReactNode;
  classes?: {
    container?: string;
  };
}

const RadioGroup: React.FC<RadioGroupProps> = (props: RadioGroupProps) => {
  const { children, label, classes } = props;
  const state = useRadioGroupState(props);
  const { radioGroupProps } = useRadioGroup(props, state);

  return (
    <div {...radioGroupProps} aria-label={label} className={classes?.container}>
      <RadioContext.Provider value={state}>{children}</RadioContext.Provider>
    </div>
  );
};

export default RadioGroup;
