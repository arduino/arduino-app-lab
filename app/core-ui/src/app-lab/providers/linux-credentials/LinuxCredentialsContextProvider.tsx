import { LinuxCredentialsContext } from './linuxCredentialsContext';
import { useLinuxCredentials } from './linuxCredentialsContextProvider.logic';

interface LinuxCredentialsContextProviderProps {
  children?: React.ReactNode;
}

const LinuxCredentialsContextProvider: React.FC<
  LinuxCredentialsContextProviderProps
> = (props: LinuxCredentialsContextProviderProps) => {
  const { children } = props;

  return (
    <LinuxCredentialsContext.Provider value={useLinuxCredentials()}>
      {children}
    </LinuxCredentialsContext.Provider>
  );
};

export default LinuxCredentialsContextProvider;
