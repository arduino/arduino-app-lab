import { SetupContext } from './setupContext';
import { useSetup } from './setupContextProvider.logic';

interface SetupContextProviderProps {
  children?: React.ReactNode;
}

const SetupContextProvider: React.FC<SetupContextProviderProps> = (
  props: SetupContextProviderProps,
) => {
  const { children } = props;

  return (
    <SetupContext.Provider value={useSetup()}>{children}</SetupContext.Provider>
  );
};

export default SetupContextProvider;
