import {
  AGENT_SETTINGS_SECTION_ID,
  AppLabWelcomeDialog,
  BoardUpdateDialog,
  CreateAppDialog,
  CreateReleaseDialog,
  CreateReleaseIntroDialog,
  FlashBoardDialog,
  ImportResourceDialog,
  NetworkSettingsDialog,
  OfflineWarningDialog,
  PreparationRequiredDialog,
  SidePanel,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import clsx from 'clsx';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { useAgentWorkspaces } from '../../hooks/useAgentWorkspaces';
import { useAppsOnAgentExit } from '../../hooks/useAppsOnAgentExit';
import { useIsBoard } from '../../hooks/useIsBoard';
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

const SwitchBoardDialog = lazy(() =>
  import('@cloud-editor-mono/ai-assistant/panel').then((module) => ({
    default: module.SwitchBoardDialog,
  })),
);

const AppLabMain: React.FC = () => {
  const {
    sidePanelLogic,
    createAppDialogLogic,
    createReleaseIntroDialogLogic,
    createReleaseDialogLogic,
    preparationRequiredDialogLogic,
    importAppDialogLogic,
    boardUpdateDialogLogic,
    flashBoardDialogLogic,
    appLabWelcomeDialogLogic,
    offlineWarningDialogLogic,
    networkSettingsDialogLogic,
    boardsProps,
    agentSidePanelProps,
    boardIsFlashing,
    showRoutes,
  } = useMainLogic();

  const { data: isBoard } = useIsBoard();

  // Agent mode is the /ai-assistant route; while there, the agent side panel replaces the app sidebar.
  const aiAssistantActive = useRouterState({
    select: (state) => state.location.pathname.startsWith('/ai-assistant'),
  });

  useAppsOnAgentExit(aiAssistantActive);

  const navigate = useNavigate();
  const openAgentSettings = useCallback(
    () => navigate({ to: '/settings', hash: AGENT_SETTINGS_SECTION_ID }),
    [navigate],
  );

  // Mount the chat panel on first entry into agent mode (keeps the bundle lazy), then keep it mounted —
  // hidden in Editor mode — so toggling modes never unmounts it. Seeded from the current route so a
  // deep-link straight to /ai-assistant renders it immediately.
  const [agentMounted, setAgentMounted] = useState(aiAssistantActive);
  useEffect(() => {
    if (aiAssistantActive) {
      setAgentMounted(true);
    }
  }, [aiAssistantActive]);

  const agentWorkspaces = useAgentWorkspaces(agentMounted);

  return (
    <>
      {/* Outside the flasher branch, because these two run their logic hook in
          their own render: unmounting them for a flash would stop the effects
          that drive them and drop the network the agent asked to connect to,
          which the hooks used to keep running here in main. */}
      <OfflineWarningDialog logic={offlineWarningDialogLogic} />
      <NetworkSettingsDialog logic={networkSettingsDialogLogic} />
      {boardIsFlashing ? (
        <FlasherFeat selectBoard={boardsProps.autoSelectBoard} />
      ) : (
        <>
          <Setup boardsProps={boardsProps} />
          <BoardUpdateDialog logic={boardUpdateDialogLogic} />
          <FlashBoardDialog logic={flashBoardDialogLogic} />
          <AppLabWelcomeDialog logic={appLabWelcomeDialogLogic} />
          {agentMounted ? (
            <Suspense fallback={null}>
              <SwitchBoardDialog />
            </Suspense>
          ) : null}
          {showRoutes ? (
            <>
              <CreateAppDialog logic={createAppDialogLogic} />
              <ImportResourceDialog logic={importAppDialogLogic} />
              <CreateReleaseIntroDialog logic={createReleaseIntroDialogLogic} />
              <CreateReleaseDialog logic={createReleaseDialogLogic} />
              <PreparationRequiredDialog
                logic={preparationRequiredDialogLogic}
              />
              {/* `isBoard` is undefined until the query resolves; only `true` means SBC. */}
              <div
                className={clsx(
                  styles['container'],
                  isBoard === true && styles['sbc'],
                )}
              >
                {aiAssistantActive ? (
                  <Suspense fallback={null}>
                    <AgentSidePanel {...agentSidePanelProps} />
                  </Suspense>
                ) : (
                  <SidePanel
                    sidePanelLogic={sidePanelLogic}
                    banner={<AgentModeBanner />}
                  />
                )}
                {/* App routes render here. Agent Mode is a sibling route that renders nothing, so the app screen unmounts there. */}
                <div className={styles['outlet']} hidden={aiAssistantActive}>
                  <Outlet />
                </div>
                {/* Persistent chat panel: mounted once, shown/hidden by mode so it never loses its stream. */}
                {agentMounted ? (
                  <div className={styles['outlet']} hidden={!aiAssistantActive}>
                    <Suspense fallback={null}>
                      <AgentPanel
                        workspaces={agentWorkspaces}
                        active={aiAssistantActive}
                        onOpenSettings={openAgentSettings}
                      />
                    </Suspense>
                  </div>
                ) : null}
              </div>

              <FooterBar boardsProps={boardsProps} />
            </>
          ) : null}
        </>
      )}
    </>
  );
};

export default AppLabMain;
