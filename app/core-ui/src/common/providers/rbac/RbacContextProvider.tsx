import { RbacContext } from './rbacContext';
import { useRbacValue } from './rbacContextProvider.logic';

interface RbacContextProviderProps {
  children?: React.ReactNode;
}

const RbacContextProvider: React.FC<RbacContextProviderProps> = ({
  children,
}: RbacContextProviderProps) => (
  <RbacContext.Provider value={useRbacValue()}>{children}</RbacContext.Provider>
);

export default RbacContextProvider;
