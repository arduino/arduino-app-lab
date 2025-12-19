import { RuntimeContext } from './runtimeContext';
import { useRuntimeLogic } from './runtimeContextProvider.logic';

interface RuntimeContextProviderProps {
  children?: React.ReactNode;
}

const RuntimeContextProvider: React.FC<RuntimeContextProviderProps> = (
  props: RuntimeContextProviderProps,
) => {
  const { children } = props;

  return (
    <RuntimeContext.Provider value={useRuntimeLogic()}>
      {children}
    </RuntimeContext.Provider>
  );
};

export default RuntimeContextProvider;
