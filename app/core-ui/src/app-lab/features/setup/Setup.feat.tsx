import { AppLabSetup } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback } from 'react';

import { createUseSetupLogic } from './setup.logic';

const Setup: React.FC = () => {
  const setupLogic = useCallback(() => createUseSetupLogic()(), []);
  return <AppLabSetup setupLogic={setupLogic} />;
};

export default Setup;
