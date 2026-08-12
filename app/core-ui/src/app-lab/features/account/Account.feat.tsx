import {
  AppLabAccount,
  PageLayout,
  TopBar,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback } from 'react';

import { createUseArduinoAccountLogic } from './account.logic';

const Account: React.FC = () => {
  const accountLogic = useCallback(() => createUseArduinoAccountLogic()(), []);

  return (
    <PageLayout header={<TopBar pathItems={['account']} />}>
      <AppLabAccount logic={accountLogic} />
    </PageLayout>
  );
};
export default Account;
