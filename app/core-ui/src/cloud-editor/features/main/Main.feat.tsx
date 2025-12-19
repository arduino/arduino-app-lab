import { GenAiBanner, Onboarding } from '@cloud-editor-mono/ui-components';
import clsx from 'clsx';
import { lazy, ReactNode, useContext } from 'react';

import { useKeywords } from '../../../common/hooks/keywords';
import { AuthContext } from '../../../common/providers/auth/authContext';
import EditSection from '../../../sections/EditSection';
import DialogSwitch from '../dialog-switch/DialogSwitch';
import HelmetWrapper from '../helmet/HelmetWrapper';
import NotificationsFeat from '../notificatons/Notifications.feat';
import { useMainLogic } from './main.logic';
import styles from './main.module.scss';

const Header = lazy(() => import('../header/Header'));
const SidenavFeat = lazy(() => import('../sidenav/Sidenav.feat'));

const Main: React.FC = () => {
  const {
    headerLogic,
    consolePanelLogic,
    toolbarLogic,
    editorPanelLogic,
    dialogSwitchLogic,
    dependentSidenavLogic,
    tabTitle,
    isFullscreen,
    isHeaderless,
    isLibraryRoute,
    onboardingLogic,
    genAiBannerLogic,
    visibilityFromUrl,
    readOnlyBarLogic,
    canUseGenAi,
    viewMode,
  } = useMainLogic();

  const { userNotTargetAudience } = useContext(AuthContext);

  const showHeader = !isHeaderless && !isFullscreen && visibilityFromUrl.header;

  const { onboardingDone } = onboardingLogic();

  const renderEditSection = (): ReactNode => {
    return isLibraryRoute || !visibilityFromUrl.toolbarAndConsole ? (
      <EditSection
        editorPanelLogic={editorPanelLogic}
        getKeywords={useKeywords}
        isCodeOnlyResource
        codeOnlyResType={
          !visibilityFromUrl.toolbarAndConsole ? 'readyOnlyMode' : 'library'
        }
        readOnlyBarLogic={
          !visibilityFromUrl.toolbarAndConsole && visibilityFromUrl.infoBar
            ? readOnlyBarLogic
            : undefined
        }
      />
    ) : (
      <EditSection
        consolePanelLogic={consolePanelLogic}
        toolbarLogic={toolbarLogic}
        editorPanelLogic={editorPanelLogic}
        getKeywords={useKeywords}
      />
    );
  };

  return !userNotTargetAudience ? (
    <>
      {!isHeaderless ? <HelmetWrapper tabTitle={tabTitle} /> : null}
      <NotificationsFeat />
      <Onboarding onboardingLogic={onboardingLogic} />
      {canUseGenAi && onboardingDone && !viewMode ? (
        <GenAiBanner genAiBannerLogic={genAiBannerLogic} />
      ) : null}
      <DialogSwitch {...dialogSwitchLogic} />
      <div
        className={clsx(styles.container, {
          [styles['container-with-header']]: showHeader,
        })}
      >
        {showHeader && <Header headerLogic={headerLogic} />}
        <div className={styles.content}>
          {visibilityFromUrl.sidenav ? (
            <SidenavFeat
              hide={isFullscreen}
              dependentSidenavLogic={dependentSidenavLogic}
            >
              {renderEditSection()}
            </SidenavFeat>
          ) : (
            renderEditSection()
          )}
        </div>
      </div>
    </>
  ) : (
    <div>{'You do not have access to this page'}</div>
  );
};

export default Main;
