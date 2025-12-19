import { SerialCommunicationContext } from './serialCommunicationContext';
import { useSerialCommunication } from './serialCommunicationContextProvider.logic';

interface SerialCommunicationContextProviderProps {
  children?: React.ReactNode;
}

const SerialCommunicationContextProvider: React.FC<
  SerialCommunicationContextProviderProps
> = (props: SerialCommunicationContextProviderProps) => {
  const { children } = props;

  const value = useSerialCommunication();

  return (
    <SerialCommunicationContext.Provider value={value}>
      {children}
    </SerialCommunicationContext.Provider>
  );
};

export default SerialCommunicationContextProvider;
