import {
  AppLabSettings,
  AppLabTopBar,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback } from 'react';

import { createUseSettingsLogic } from './settings.logic';
import styles from './settings.module.scss';

const Settings: React.FC = () => {
  const settingsLogic = useCallback(() => createUseSettingsLogic()(), []);
  return (
    <section className={styles['main']}>
      <AppLabTopBar pathItems={['settings']} />
      <AppLabSettings settingsLogic={settingsLogic} />
    </section>
  );
};
export default Settings;
