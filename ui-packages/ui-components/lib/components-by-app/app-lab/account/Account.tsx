import { UseArduinoAccountLogic } from './account.type';
import Login from './sub-components/Login';
import Logout from './sub-components/Logout';

interface AccountProps {
  logic: UseArduinoAccountLogic;
}

const Account: React.FC<AccountProps> = (props: AccountProps) => {
  const { logic } = props;
  const { logout, user, login, skip } = logic();

  return (
    <>
      {!user ? (
        <Login login={login} skip={skip} />
      ) : (
        <Logout user={user} logout={logout} />
      )}
    </>
  );
};

export default Account;
