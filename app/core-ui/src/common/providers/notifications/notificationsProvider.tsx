import { NotificationsContext } from './notificationsContext';
import { useActionNotification } from './notificationsProvider.logic';

interface NotificationsProviderProps {
  children?: React.ReactNode;
}

const NotificationsProvider: React.FC<NotificationsProviderProps> = (
  props: NotificationsProviderProps,
) => {
  const { children } = props;

  const value = useActionNotification();

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export default NotificationsProvider;
