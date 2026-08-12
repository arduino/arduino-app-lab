import { LanguageServerContext } from './languageServerContext';
import { useLanguageServer } from './languageServerContextProvider.logic';

interface LanguageServerContextProviderProps {
  children?: React.ReactNode;
}

const LanguageServerContextProvider: React.FC<
  LanguageServerContextProviderProps
> = (props: LanguageServerContextProviderProps) => {
  const { children } = props;

  return (
    <LanguageServerContext.Provider value={useLanguageServer()}>
      {children}
    </LanguageServerContext.Provider>
  );
};

export default LanguageServerContextProvider;
