import {
  AppLabSettings,
  TopBar,
  TopBarBack,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';

import { createUseSettingsLogic } from './settings.logic';
import styles from './settings.module.scss';

const Settings: React.FC = () => {
  const settingsLogic = useCallback(() => createUseSettingsLogic()(), []);

  const router = useRouter();
  const goBack = useCallback(() => {
    // In case we want to re-enable going back to previous page in the future:
    // const currentUrl = router.state.location.pathname;
    // const prevUrl = prevUrlRef.current;
    // if (canGoBack && prevUrl !== currentUrl) {
    //   router.history.back();
    // } else {
    //   router.navigate({ to: '/learn' }); // fallback
    // }
    router.navigate({ to: '/' });
  }, [router]);

  return (
    <section className={styles['main']}>
      <div className={styles['header']}>
        <TopBar
          pathItems={[<TopBarBack label="Settings" onClick={goBack} key={0} />]}
        />
      </div>
      <div className={styles['body']}>
        <div className={styles['content']}>
          <AppLabSettings settingsLogic={settingsLogic} />
        </div>
      </div>
    </section>
  );
};
export default Settings;
