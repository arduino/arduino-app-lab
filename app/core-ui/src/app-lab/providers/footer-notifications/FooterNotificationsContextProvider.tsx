import { FooterNotificationsContext } from './footerNotificationsContext';
import { useFooterNotificationsLogic } from './footerNotificationsContextProvider.logic';

interface FooterNotificationsContextProviderProps {
  children?: React.ReactNode;
}

const FooterNotificationsContextProvider: React.FC<
  FooterNotificationsContextProviderProps
> = (props: FooterNotificationsContextProviderProps) => {
  const { children } = props;

  return (
    <FooterNotificationsContext.Provider value={useFooterNotificationsLogic()}>
      {children}
    </FooterNotificationsContext.Provider>
  );
};

export default FooterNotificationsContextProvider;
