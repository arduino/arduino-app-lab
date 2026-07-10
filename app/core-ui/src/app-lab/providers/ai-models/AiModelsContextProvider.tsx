import { AiModelsContext } from './aiModelsContext';
import { useAiModelsLogic } from './aiModelsContextProvider.logic';

interface AiModelsContextProviderProps {
  children?: React.ReactNode;
}

const AiModelsContextProvider: React.FC<AiModelsContextProviderProps> = (
  props: AiModelsContextProviderProps,
) => {
  const { children } = props;

  return (
    <AiModelsContext.Provider
      value={useAiModelsLogic({ enabled: true })} // TODO: enable only when consumer requires it
    >
      {children}
    </AiModelsContext.Provider>
  );
};

export default AiModelsContextProvider;
