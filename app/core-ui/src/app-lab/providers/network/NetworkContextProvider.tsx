import { NetworkContext } from './networkContext';
import { useNetwork } from './networkContextProvider.logic';

interface NetworkContextProviderProps {
  children?: React.ReactNode;
}

const NetworkContextProvider: React.FC<NetworkContextProviderProps> = (
  props: NetworkContextProviderProps,
) => {
  const { children } = props;

  return (
    <NetworkContext.Provider value={useNetwork()}>
      {children}
    </NetworkContext.Provider>
  );
};

export default NetworkContextProvider;
