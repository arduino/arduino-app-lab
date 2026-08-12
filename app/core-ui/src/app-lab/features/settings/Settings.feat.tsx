import { isFFEnabled } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppLabSettings,
  PageLayout,
  TopBar,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { lazy, Suspense, useCallback } from 'react';

import { createUseSettingsLogic } from './settings.logic';
import styles from './settings.module.scss';

const AgentSettings = lazy(() =>
  import('@cloud-editor-mono/ai-assistant/panel').then((module) => ({
    default: module.AgentSettings,
  })),
);

const Settings: React.FC = () => {
  const settingsLogic = useCallback(() => createUseSettingsLogic()(), []);

  return (
    <PageLayout header={<TopBar pathItems={['settings']} />}>
      <div className={styles['content']}>
        <AppLabSettings
          settingsLogic={settingsLogic}
          agentSection={
            isFFEnabled('AI_ASSISTANT') ? (
              <Suspense fallback={null}>
                <AgentSettings />
              </Suspense>
            ) : undefined
          }
        />
      </div>
    </PageLayout>
  );
};
export default Settings;
