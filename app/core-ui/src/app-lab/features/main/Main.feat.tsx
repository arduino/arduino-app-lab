import { isFFEnabled } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  AppLabWelcomeDialog,
  BoardUpdateDialog,
  CreateAppDialog,
  FlashBoardDialog,
  ImportResourceDialog,
  NetworkSettingsDialog,
  OfflineWarningDialog,
  SidePanel,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useState } from 'react';

import AgentModeBanner from '../agent-mode-banner/AgentModeBanner.feat';
import { FlasherFeat } from '../flasher/Flasher.feat';
import FooterBar from '../footer-bar/FooterBar.feat';
import Setup from '../setup/Setup.feat';
import { useMainLogic } from './main.logic';
import styles from './main.module.scss';

// Lazy so the agent bundle is fetched only once the user enters agent mode (same chunk the route uses).
const AgentSidePanel = lazy(() =>
  import('@cloud-editor-mono/ai-assistant/panel').then((module) => ({
    default: module.AgentSidePanel,
  })),
);

// The chat panel is rendered persistently by the layout (not the /ai-assistant route) and kept mounted
// across the Editor<->Agent toggle, so its stream subscription survives (no lost turn-end → no stuck "…")
// and switching is a show/hide, not a remount (no re-shown loader).
const AgentPanel = lazy(() =>
  import('@cloud-editor-mono/ai-assistant/panel').then((module) => ({
    default: module.AiAssistantPanel,
  })),
);

const AppLabMain: React.FC = () => {
  const {
    sidePanelLogic,
    createAppDialogLogic,
    importAppDialogLogic,
    boardUpdateDialogLogic,
    flashBoardDialogLogic,
    appLabWelcomeDialogLogic,
    offlineWarningDialogLogic,
    networkSettingsDialogLogic,
    boardsProps,
    agentSidePanelLogic,
    boardIsFlashing,
    showRoutes,
  } = useMainLogic();

  // Agent mode is the /ai-assistant route; while there, the agent side panel replaces the app sidebar.
  const aiAssistantActive = useRouterState({
    select: (state) => state.location.pathname.startsWith('/ai-assistant'),
  });

  // Mount the chat panel on first entry into agent mode (keeps the bundle lazy), then keep it mounted —
  // hidden in Editor mode — so toggling modes never unmounts it. Seeded from the current route so a
  // deep-link straight to /ai-assistant renders it immediately.
  const [agentMounted, setAgentMounted] = useState(aiAssistantActive);
  useEffect(() => {
    if (aiAssistantActive) {
      setAgentMounted(true);
    }
  }, [aiAssistantActive]);

  return boardIsFlashing ? (
    <FlasherFeat selectBoard={boardsProps.autoSelectBoard} />
  ) : (
    <>
      <Setup boardsProps={boardsProps} />
      <BoardUpdateDialog logic={boardUpdateDialogLogic} />
      <FlashBoardDialog logic={flashBoardDialogLogic} />
      <AppLabWelcomeDialog logic={appLabWelcomeDialogLogic} />
      <OfflineWarningDialog logic={offlineWarningDialogLogic} />
      <NetworkSettingsDialog logic={networkSettingsDialogLogic} />
      {showRoutes ? (
        <>
          <CreateAppDialog logic={createAppDialogLogic} />
          <ImportResourceDialog logic={importAppDialogLogic} />
          <div className={styles['container']}>
            {aiAssistantActive ? (
              <Suspense fallback={null}>
                <AgentSidePanel {...agentSidePanelLogic} />
              </Suspense>
            ) : (
              <SidePanel
                sidePanelLogic={sidePanelLogic}
                banner={
                  isFFEnabled('AI_ASSISTANT') ? <AgentModeBanner /> : undefined
                }
              />
            )}
            {/* Editor/app routes render here; hidden (not unmounted) while in agent mode. */}
            <div className={styles['outlet']} hidden={aiAssistantActive}>
              <Outlet />
            </div>
            {/* Persistent chat panel: mounted once, shown/hidden by mode so it never loses its stream. */}
            {agentMounted ? (
              <div className={styles['outlet']} hidden={!aiAssistantActive}>
                <Suspense fallback={null}>
                  <AgentPanel />
                </Suspense>
              </div>
            ) : null}
          </div>

          <FooterBar boardsProps={boardsProps} />
        </>
      ) : null}
    </>
  );
};

export default AppLabMain;
