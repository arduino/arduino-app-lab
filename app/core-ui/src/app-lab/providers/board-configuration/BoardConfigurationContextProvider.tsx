import { BoardConfigurationContext } from './boardConfigurationContext';
import { useBoardConfiguration } from './boardConfigurationContextProvider.logic';

interface BoardConfigurationContextProviderProps {
  children?: React.ReactNode;
}

const BoardConfigurationContextProvider: React.FC<
  BoardConfigurationContextProviderProps
> = (props: BoardConfigurationContextProviderProps) => {
  const { children } = props;

  return (
    <BoardConfigurationContext.Provider value={useBoardConfiguration()}>
      {children}
    </BoardConfigurationContext.Provider>
  );
};

export default BoardConfigurationContextProvider;
