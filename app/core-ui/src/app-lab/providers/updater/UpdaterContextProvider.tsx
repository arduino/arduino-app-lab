import { UpdaterContext } from './updaterContext';
import { useUpdater } from './updaterContextProvider.logic';

interface UpdaterContextProviderProps {
  children?: React.ReactNode;
}

const UpdaterContextProvider: React.FC<UpdaterContextProviderProps> = (
  props: UpdaterContextProviderProps,
) => {
  const { children } = props;

  return (
    <UpdaterContext.Provider value={useUpdater()}>
      {children}
    </UpdaterContext.Provider>
  );
};

export default UpdaterContextProvider;
