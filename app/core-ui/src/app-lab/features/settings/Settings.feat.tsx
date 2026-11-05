import {
  AppLabSettings,
  PageLayout,
  TopBar,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useNavigate } from '@tanstack/react-router';
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
  const navigate = useNavigate();
  const openAgentMode = useCallback(
    (): void => void navigate({ to: '/ai-assistant' }),
    [navigate],
  );

  return (
    <PageLayout header={<TopBar pathItems={['settings']} />}>
      <div className={styles['content']}>
        <AppLabSettings
          settingsLogic={settingsLogic}
          agentSection={
            <Suspense fallback={null}>
              <AgentSettings onStartBuilding={openAgentMode} />
            </Suspense>
          }
        />
      </div>
    </PageLayout>
  );
};
export default Settings;
