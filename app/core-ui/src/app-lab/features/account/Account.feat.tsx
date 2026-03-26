import {
  AppLabAccount,
  TopBar,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback } from 'react';

import { createUseArduinoAccountLogic } from './account.logic';
import styles from './account.module.scss';

const Account: React.FC = () => {
  const accountLogic = useCallback(() => createUseArduinoAccountLogic()(), []);

  return (
    <section className={styles['main']}>
      <TopBar pathItems={['account']} />
      <AppLabAccount logic={accountLogic} />
    </section>
  );
};
export default Account;
